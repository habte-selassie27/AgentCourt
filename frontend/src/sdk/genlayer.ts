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
    try {
      const result = await this.client.readContract({
        address: to as `0x${string}`,
        functionName: method,
        args: args as any[],
      });
      return { ok: true, data: result as T };
    } catch (err: any) {
      const message = err?.message ?? String(err);

      // Check for contract execution errors
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

      // Network / RPC errors
      if (/fetch|network|timeout|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|failed to fetch/i.test(message)) {
        return {
          ok: false,
          error: {
            kind: 'rpc',
            message: `Could not reach the GenLayer RPC (${this.rpcUrl}). Check your connection or the VITE_RPC_URL setting.`,
          },
        };
      }

      return {
        ok: false,
        error: { kind: 'rpc', message },
      };
    }
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

  /**
   * Write through genlayer-js (NOT ethers/eth_call).
   * Returns the transaction hash; waits for FINALIZED and checks execution result.
   */
  async genWrite(
    to: string,
    method: string,
    args: unknown[],
    opts: { value?: bigint } = {},
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

    const receipt = await this.client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
    } as any);

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
}

export { ExecutionResult, TransactionStatus };
