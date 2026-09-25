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

  // ACCEPTED but validators never agreed — the write committed nothing.
  if (e.name === 'ConsensusFailedError' || /validators did not agree|NO_MAJORITY/i.test(message)) {
    return {
      title: 'Evaluation did not reach consensus',
      hint:
        'The transaction was accepted but validators did not agree on the leader result, ' +
        'so no state changed on-chain. This usually means the nondeterministic evaluation ' +
        'failed on the leader (it can also time out). The dispute is unchanged — retrying is safe.',
      detail: message,
      retryable: true,
    };
  }

  // Tx submitted but still running (evaluation / consensus takes minutes)
  if (
    e.name === 'TransactionPendingError' ||
    /Timed out waiting for transaction|is still (PENDING|PROPOSING|COMMITTING|REVEALING)/i.test(message)
  ) {
    return {
      title: 'Transaction still processing',
      hint:
        'The transaction was signed and is on-chain, but has not reached ACCEPTED yet. ' +
        'Request Evaluation (LLM + consensus) can take several minutes. ' +
        'Do not resubmit — this page will auto-refresh.',
      detail: message,
      retryable: false,
    };
  }

  // Wallet account mismatch (switched accounts in Rabby/MetaMask after connect)
  if (
    /from should be same as current address|-32602|from address|wrong from/i.test(message) ||
    /no selected account|wallet has no selected account/i.test(message)
  ) {
    return {
      title: 'Wallet account changed',
      hint:
        'Your wallet selected a different account than this page is using. ' +
        'The app will resync automatically — switch back to the original account, or reconnect the wallet and retry.',
      detail: message,
      retryable: true,
    };
  }

  // Network / RPC reachability (incl. transient Cloudflare 502s that Chrome reports as CORS)
  if (/could not reach|network|fetch failed|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|Failed to fetch|Bad Gateway|ERR_FAILED|CORS/i.test(message)) {
    return {
      title: 'RPC briefly unreachable',
      hint:
        'The GenLayer endpoint returned a temporary error (often a 502 that Chrome shows as CORS). ' +
        'This usually clears in a few seconds — hard-refresh (Ctrl+Shift+R) and retry. ' +
        'If it persists, check the VITE_RPC_URL for this deployment.',
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
