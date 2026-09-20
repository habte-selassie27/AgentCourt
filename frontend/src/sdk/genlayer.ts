// Minimal GenLayer JSON-RPC client for Intelligent Contracts (Python ICs).
//
// ICs are not Solidity contracts: `eth_call` against them returns placeholder
// data, so ALL reads must go through `gen_call` with a JSON payload
// hex-encoded into `data`.

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
    super(`The on-chain contract failed while running "${method}".`);
    this.name = 'ContractExecutionError';
    this.method = method;
    this.detail = detail;
  }
}

export interface GenCallResult<T = unknown> {
  ok: boolean;
  /** Decoded JSON result when ok, undefined otherwise. */
  data?: T;
  /** Structured error info when !ok. */
  error?: {
    kind: 'rpc' | 'execution';
    code?: number;
    message: string;
    /** Base64 receipt result (often "exit_code 1") when kind === 'execution'. */
    executionResult?: string;
  };
}

function utf8ToHex(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function base64ToUtf8(b64: string): string {
  try {
    return atob(b64);
  } catch {
    return b64;
  }
}

export class GenLayerClient {
  private nextId = 1;

  constructor(readonly rpcUrl: string) {}

  async genCall<T = unknown>(to: string, method: string, args: unknown[]): Promise<T> {
    const res = await this.genCallRaw<T>(to, method, args);
    if (res.ok && res.data !== undefined) return res.data;
    throw new Error(res.error?.message ?? `gen_call ${method} failed`);
  }

  async genCallRaw<T = unknown>(to: string, method: string, args: unknown[]): Promise<GenCallResult<T>> {
    let res: Response;
    try {
      res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.nextId++,
          method: 'gen_call',
          params: [
            {
              from: '0x0000000000000000000000000000000000000000',
              to,
              type: 'read',
              data: utf8ToHex(JSON.stringify({ method, args })),
            },
          ],
        }),
      });
    } catch (e) {
      return {
        ok: false,
        error: {
          kind: 'rpc',
          message: `Could not reach the GenLayer RPC (${this.rpcUrl}). Check your connection or the VITE_RPC_URL setting.`,
        },
      };
    }

    let json: {
      result?: string;
      error?: { code?: number; message?: string; data?: { receipt?: { result?: string } } };
    };
    try {
      json = await res.json();
    } catch {
      return {
        ok: false,
        error: { kind: 'rpc', message: `GenLayer RPC returned a non-JSON response (HTTP ${res.status}).` },
      };
    }

    if (json.error) {
      const receipt = json.error.data?.receipt;
      if (receipt) {
        const executionResult = receipt.result ? base64ToUtf8(receipt.result) : undefined;
        return {
          ok: false,
          error: {
            kind: 'execution',
            code: json.error.code,
            message: `Contract execution failed (${executionResult ?? json.error.message ?? 'unknown error'}).`,
            executionResult,
          },
        };
      }
      return {
        ok: false,
        error: { kind: 'rpc', code: json.error.code, message: json.error.message ?? 'Unknown RPC error.' },
      };
    }

    if (typeof json.result !== 'string') {
      // Some nodes return the parsed value directly.
      return { ok: true, data: json.result as T };
    }

    const raw = json.result;
    if (raw.startsWith('0x')) {
      // Hex-encoded JSON or hex-encoded string.
      const bytes = new Uint8Array(
        (raw.slice(2).match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
      );
      const decoded = new TextDecoder().decode(bytes);
      try {
        return { ok: true, data: JSON.parse(decoded) as T };
      } catch {
        return { ok: true, data: decoded as unknown as T };
      }
    }
    try {
      return { ok: true, data: JSON.parse(raw) as T };
    } catch {
      return { ok: true, data: raw as unknown as T };
    }
  }
}
