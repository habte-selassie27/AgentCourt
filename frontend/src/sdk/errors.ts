// Translates raw SDK/RPC errors into user-friendly, actionable messages.

export interface FriendlyError {
  title: string;
  hint: string;
  detail?: string;
  retryable: boolean;
}

interface ErrLike {
  message?: string;
  method?: string;
  detail?: string;
  name?: string;
}

export function describeError(err: unknown): FriendlyError {
  const e = (err ?? {}) as ErrLike;
  const message = e.message ?? String(err ?? 'Unknown error');

  // Contract execution failure (raised by genlayer.ts / read path)
  if (e.name === 'ContractExecutionError' || /contract execution failed/i.test(message)) {
    return {
      title: 'The court contracts are temporarily unavailable',
      hint:
        'The deployed Intelligent Contracts failed to execute on GenLayer Studionet. ' +
        'This is a contract-side issue (likely a runtime version mismatch) — nothing is wrong with your setup.',
      detail: e.detail ?? message,
      retryable: true,
    };
  }

  // Network / RPC reachability
  if (/could not reach|network|fetch|timeout|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|Failed to fetch/i.test(message)) {
    return {
      title: 'Cannot reach the GenLayer network',
      hint:
        'Your browser could not contact the RPC endpoint. Check your internet connection ' +
        'and the VITE_RPC_URL configured for this deployment.',
      detail: message,
      retryable: true,
    };
  }

  // Not found
  if (/does not exist|not found|no such/i.test(message)) {
    return {
      title: 'Not found on-chain',
      hint: 'The requested dispute or evidence does not exist on this chain.',
      detail: message,
      retryable: false,
    };
  }

  // Fallback
  return {
    title: 'Something went wrong while loading on-chain data',
    hint: 'An unexpected error occurred. You can try again — if it persists, check the browser console (F12) for details.',
    detail: message,
    retryable: true,
  };
}
