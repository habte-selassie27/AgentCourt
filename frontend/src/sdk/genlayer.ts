// GenLayer JSON-RPC client for Intelligent Contracts (Python ICs).
//
// Uses the official genlayer-js SDK for proper calldata encoding.
// ICs are NOT Solidity contracts — `eth_call` returns placeholder data,
// so ALL reads go through `gen_call` with GenLayer-native binary calldata.

import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { ExecutionResult, TransactionStatus } from 'genlayer-js/types';

export class GenlayerRpcError extends Error {
  readonly code: number | undefined;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'GenlayerRpcError';
    this.code = code;
  }
}

/** The contract loaded but crashed while executing the requested method. */
export class ContractExecutionError extends Error {
  readonly method: string;
  readonly detail: string;
  constructor(method: string, detail: string) {
    super(
      detail
        ? `The on-chain contract failed while running "${method}": ${detail}`
        : `The on-chain contract failed while running "${method}".`,
    );
    this.name = 'ContractExecutionError';
    this.method = method;
    this.detail = detail;
  }
}

/**
 * Tx was submitted but not ACCEPTED yet (common for request_evaluation —
 * LLM + consensus can run for many minutes).
 */
export class TransactionPendingError extends Error {
  readonly hash: string;
  readonly status: string;
  constructor(hash: string, status: string) {
    super(
      `Transaction ${hash} is still ${status} on GenLayer. ` +
        'Evaluation can take several minutes — do not resubmit; refresh this page.',
    );
    this.name = 'TransactionPendingError';
    this.hash = hash;
    this.status = status;
  }
}

/**
 * True for transient RPC failures that can occur mid-poll while a long-running
 * transaction (e.g. request_evaluation) is still processing: gateway blips,
 * 502/503/504s that Chrome reports as CORS "Failed to fetch", and short
 * indexing lag right after submission ("Transaction not found").
 *
 * The SDK's own "Timed out waiting for transaction" is deliberately NOT
 * transient — it means the wait budget genuinely expired.
 */
export function isTransientRpcWaitError(message: string): boolean {
  if (/Timed out waiting for transaction/i.test(message)) return false;
  return /fetch|network|timeout|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|failed to fetch|502|503|504|Bad Gateway|CORS|ERR_FAILED|Transaction not found/i.test(
    message,
  );
}

export interface GenCallResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    kind: 'rpc' | 'execution';
    code?: number;
    message: string;
    executionResult?: string;
  };
}

type AnyClient = ReturnType<typeof createClient>;

export class GenLayerClient {
  private client: AnyClient;
  private writeClient: AnyClient | null = null;
  private writeAddress: `0x${string}` | null = null;

  constructor(readonly rpcUrl: string) {
    this.client = createClient({
      endpoint: rpcUrl,
      chain: {
        ...studionet,
        rpcUrls: { default: { http: [rpcUrl] } },
      },
    });
  }

  /** Attach a browser wallet for writeContract (MetaMask / Rabby / etc.). */
  async connectWallet(ethereum: unknown, address: `0x${string}`): Promise<void> {
    this.writeAddress = address;
    this.writeClient = createClient({
      endpoint: this.rpcUrl,
      chain: {
        ...studionet,
        rpcUrls: { default: { http: [this.rpcUrl] } },
      },
      account: address,
      provider: ethereum as any,
    } as any);
  }

  get connectedAddress(): `0x${string}` | null {
    return this.writeAddress;
  }

  get hasWriteClient(): boolean {
    return this.writeClient !== null;
  }

  async genCall<T = unknown>(to: string, method: string, args: unknown[]): Promise<T> {
    const res = await this.genCallRaw<T>(to, method, args);
    if (res.ok && res.data !== undefined) return res.data;
    throw new Error(res.error?.message ?? `gen_call ${method} failed`);
  }

  async genCallRaw<T = unknown>(to: string, method: string, args: unknown[]): Promise<GenCallResult<T>> {
    const maxAttempts = 3;
    let lastMessage = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.client.readContract({
          address: to as `0x${string}`,
          functionName: method,
          args: args as any[],
        });
        return { ok: true, data: result as T };
      } catch (err: any) {
        const message = err?.message ?? String(err);
        lastMessage = message;

        // Check for contract execution errors (not retryable)
        if (/execution failed|exit_code|contract execution/i.test(message)) {
          return {
            ok: false,
            error: {
              kind: 'execution',
              message: `Contract execution failed (${message}).`,
              executionResult: message,
            },
          };
        }

        // Transient network / RPC errors — retry briefly (Cloudflare 502s clear in seconds)
        const isNetwork = /fetch|network|timeout|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|failed to fetch|502|503|504|Bad Gateway/i.test(message);
        if (isNetwork) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, attempt * 700));
            continue;
          }
          return {
            ok: false,
            error: {
              kind: 'rpc',
              message: `Could not reach the GenLayer RPC (${this.rpcUrl}) after ${maxAttempts} attempts. The endpoint may be briefly down — retry in a moment.`,
            },
          };
        }

        return {
          ok: false,
          error: { kind: 'rpc', message },
        };
      }
    }
    return {
      ok: false,
      error: {
        kind: 'rpc',
        message: lastMessage || `gen_call ${method} failed`,
      },
    };
  }

  /** Raise if the finalized leader receipt reports a contract error / rollback. */
  private assertLeaderReceiptOk(receipt: unknown, method: string): void {
    const leaders = (receipt as any)?.consensus_data?.leader_receipt;
    if (!Array.isArray(leaders)) return;

    for (const leader of leaders) {
      if (!leader || typeof leader !== 'object') continue;
      const result = leader.result;
      if (result && typeof result === 'object') {
        const status = String((result as any).status ?? '');
        const payload = String((result as any).payload ?? '');
        if (
          status === 'contract_error' ||
          status === 'rollback' ||
          status === 'error' ||
          /exit_code\s+\d+/i.test(payload) ||
          /rollback|contract_error/i.test(status)
        ) {
          throw new ContractExecutionError(method, payload || status);
        }
      }

      // Some nodes expose only a textual execution_result.
      const exec = String((leader as any)?.execution_result ?? '');
      if (exec && exec !== 'FINISHED_WITH_RETURN' && /error|exit_code|rollback/i.test(exec)) {
        throw new ContractExecutionError(method, exec);
      }
    }
  }

  /** See isTransientRpcWaitError — transient failures are retryable during a wait. */
  private isTransientRpcError(message: string): boolean {
    return isTransientRpcWaitError(message);
  }

  /**
   * Wait for a transaction to reach ACCEPTED while tolerating transient RPC
   * failures (studionet's gateway intermittently answers 502; Chrome surfaces
   * those as CORS "Failed to fetch" errors mid-poll).
   *
   * ACCEPTED is consensus-decided and typically lands in ~2–5s on Studionet;
   * waiting only for FINALIZED added many seconds of pure finality lag to every
   * create/evidence/investigation write.
   *
   * The underlying genlayer-js wait aborts on the first such error, so we wrap
   * it and keep spending the remaining budget. `totalRetries` is expressed in
   * polls of `intervalMs` (default 1s).
   */
  private async waitForAcceptedReceipt(
    hash: string,
    totalRetries: number,
    intervalMs: number,
  ): Promise<unknown> {
    const CHUNK = 60;
    let waited = 0;
    while (waited < totalRetries) {
      const budget = Math.min(CHUNK, totalRetries - waited);
      waited += budget;
      try {
        return await this.client.waitForTransactionReceipt({
          hash: hash as `0x${string}`,
          status: TransactionStatus.ACCEPTED,
          interval: intervalMs,
          retries: budget,
        } as any);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (/Timed out waiting for transaction/i.test(message)) {
          continue;
        }
        if (!this.isTransientRpcError(message)) {
          throw err;
        }
        // RPC blip — pause briefly, then keep waiting with the remaining budget.
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw new Error(
      `Timed out waiting for transaction ${hash} to reach status "ACCEPTED".`,
    );
  }

  private static isDoneStatus(status: string | null): boolean {
    if (status === null) return false;
    const s = status.toUpperCase();
    return (
      s === 'ACCEPTED' ||
      s === 'FINALIZED' ||
      s === '5' ||
      s === '7' ||
      s === 'DECIDED'
    );
  }

  /**
   * Write through genlayer-js (NOT ethers/eth_call).
   * Returns the transaction hash; waits for ACCEPTED and checks execution result.
   *
   * Pass `{ wait: false }` to return as soon as the tx is submitted (caller
   * batches further writes, then polls chain state once).
   */
  async genWrite(
    to: string,
    method: string,
    args: unknown[],
    opts: {
      value?: bigint;
      waitRetries?: number;
      waitIntervalMs?: number;
      wait?: boolean;
    } = {},
  ): Promise<string> {
    if (!this.writeClient) {
      throw new Error('Wallet not connected');
    }

    const hash = await this.writeClient.writeContract({
      address: to as `0x${string}`,
      functionName: method,
      args: args as any[],
      value: opts.value ?? BigInt(0),
    } as any);

    if (opts.wait === false) {
      return String(hash);
    }

    // ACCEPTED ≈ 2–5s with 1s polls; eval still gets a long wall-clock budget.
    const interval = opts.waitIntervalMs ?? 1_000;
    const retries = opts.waitRetries ?? 90; // ~90s for normal writes

    let receipt: unknown;
    try {
      receipt = await this.waitForAcceptedReceipt(String(hash), retries, interval);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/Timed out waiting for transaction/i.test(message)) {
        throw err;
      }
      const current = await this.safeGetStatus(String(hash));
      if (current !== null && !GenLayerClient.isDoneStatus(current)) {
        throw new TransactionPendingError(String(hash), current);
      }
      receipt = await this.client
        .waitForTransactionReceipt({
          hash,
          status: TransactionStatus.ACCEPTED,
          interval: 500,
          retries: 10,
        } as any)
        .catch(() => null);
      if (!receipt) {
        if (GenLayerClient.isDoneStatus(current)) {
          return String(hash);
        }
        throw new TransactionPendingError(String(hash), current ?? 'unknown');
      }
    }

    // Preferred: explicit execution result when the node provides it.
    const execName = (receipt as any)?.txExecutionResultName;
    if (
      execName !== undefined &&
      execName !== null &&
      execName !== ExecutionResult.FINISHED_WITH_RETURN &&
      execName !== 'FINISHED_WITH_RETURN'
    ) {
      throw new ContractExecutionError(method, String(execName));
    }

    // Studionet often omits txExecutionResult. Fall back to leader receipt:
    // { status: 'contract_error' | 'rollback', payload: 'exit_code 1' | 'Dispute not found' }.
    this.assertLeaderReceiptOk(receipt, method);

    return String(hash);
  }

  /** Status lookup with a few retries — this call itself can hit RPC blips. */
  private async safeGetStatus(hash: string, attempts = 3): Promise<string | null> {
    for (let i = 0; i < attempts; i++) {
      try {
        const tx = (await this.client.getTransaction({ hash } as any)) as any;
        const name = tx?.statusName ?? tx?.status;
        return name === undefined || name === null ? null : String(name);
      } catch {
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 1_500));
        }
      }
    }
    return null;
  }
}

export { ExecutionResult, TransactionStatus };
