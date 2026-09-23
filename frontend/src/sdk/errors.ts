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
  if (e.name === 'ContractExecutionError' || /contract execution failed|on-chain contract failed/i.test(message)) {
    const detail = e.detail ?? message;
    return {
      title: 'On-chain transaction failed',
      hint:
        'The Intelligent Contract rejected this write on GenLayer Studionet. ' +
        'The form draft was kept — fix the highlighted field and try again.',
      detail,
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
