import { describe, it, expect } from 'vitest';
import {
  DISPUTE_STATUSES,
  getStatusClass,
  disputeIdLabel,
  isActive,
  isResolved,
} from '../frontend/src/dispute';
import { VERDICTS, confidencePercent } from '../frontend/src/verdict';
import { describeError } from '../frontend/src/sdk/errors';
import {
  ConsensusFailedError,
  detectConsensusFailure,
  isTransientRpcWaitError,
  TransactionPendingError,
} from '../frontend/src/sdk/genlayer';

describe('dispute domain', () => {
  it('includes evaluation fail-closed statuses', () => {
    expect(DISPUTE_STATUSES).toContain('EVALUATION_PENDING');
    expect(DISPUTE_STATUSES).toContain('EVALUATION_FAILED');
    expect(DISPUTE_STATUSES).toContain('INCONCLUSIVE');
    expect(DISPUTE_STATUSES).toContain('DISPUTED');
  });

  it('maps status to css class without caller-supplied verdicts', () => {
    expect(getStatusClass('CONSENSUS')).toBe('status-badge status-CONSENSUS');
    expect(disputeIdLabel(184n)).toBe('AC-000184');
  });

  it('treats terminal and active statuses correctly', () => {
    expect(isResolved('VERDICT')).toBe(true);
    expect(isResolved('CLOSED')).toBe(true);
    expect(isActive('INVESTIGATION')).toBe(true);
    expect(isActive('EVALUATION_FAILED')).toBe(true);
  });
});

describe('verdict domain', () => {
  it('excludes NONE from finalizable labels used by UI', () => {
    expect(VERDICTS).toEqual(
      expect.arrayContaining(['TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE', 'REVIEW']),
    );
  });

  it('converts basis-points confidence to percent', () => {
    expect(confidencePercent(9100n)).toBe(91);
    expect(confidencePercent(0n)).toBe(0);
    expect(confidencePercent(10000n)).toBe(100);
  });
});

describe('bytes32 hash normalization', () => {
  function toBytes32(input: string, fallback: () => string): string {
    const trimmed = input.trim();
    if (!trimmed) return '0x' + fallback().replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
    const hex = trimmed.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length > 64) {
      throw new Error('Hash must be hex (0x optional) and at most 32 bytes.');
    }
    return '0x' + hex.padStart(64, '0');
  }

  it('strips a single 0x and never produces 0x0x', () => {
    const h = '0x' + 'ab'.repeat(32);
    const out = toBytes32(h, () => 'ff');
    expect(out.startsWith('0x0x')).toBe(false);
    expect(out).toBe(h);
    expect(out).toHaveLength(66);
  });

  it('accepts unprefixed hex and pads short hashes', () => {
    expect(toBytes32('5d46', () => 'x')).toBe('0x' + '0'.repeat(60) + '5d46');
  });

  it('rejects double-prefixed and non-hex input', () => {
    expect(() => toBytes32('0x0xab', () => 'x')).toThrow();
    expect(() => toBytes32('zzzz', () => 'x')).toThrow();
    expect(() => toBytes32('0x' + 'aa'.repeat(33), () => 'x')).toThrow();
  });
});

describe('describeError', () => {
  it('classifies wait timeouts as still-processing, not network down', () => {
    const err = new Error(
      'Timed out waiting for transaction 0xabc to reach status "FINALIZED" (current status: 1).',
    );
    const friendly = describeError(err);
    expect(friendly.title).toBe('Transaction still processing');
    expect(friendly.retryable).toBe(false);
  });

  it('classifies TransactionPendingError as still-processing', () => {
    const err = new TransactionPendingError('0xabc', 'PENDING');
    const friendly = describeError(err);
    expect(friendly.title).toBe('Transaction still processing');
    expect(err.name).toBe('TransactionPendingError');
    expect(err.hash).toBe('0xabc');
  });

  it('classifies a NO_MAJORITY consensus failure as its own error', () => {
    const err = new ConsensusFailedError('request_evaluation', 'NO_MAJORITY', 0, 'genvm_crash_handler');
    const friendly = describeError(err);
    expect(friendly.title).toBe('Evaluation did not reach consensus');
    expect(friendly.retryable).toBe(true);
    expect(err.name).toBe('ConsensusFailedError');
    // The leader-crash fingerprint must survive into the message.
    expect(err.message).toContain('NO_MAJORITY');
    expect(err.message).toContain('genvm_crash_handler');
    expect(err.message).toContain('0 validator votes committed');
  });

  it('classifies wallet account drift (-32602 from mismatch)', () => {
    const friendly = describeError(
      new Error(
        "Error using provider for method eth_sendTransaction: {code: -32602, message: 'from should be same as current address'}",
      ),
    );
    expect(friendly.title).toBe('Wallet account changed');
    expect(friendly.retryable).toBe(true);
  });

  it('classifies missing wallet account after disconnect', () => {
    const friendly = describeError(
      new Error('Wallet has no selected account — reconnect and try again.'),
    );
    expect(friendly.title).toBe('Wallet account changed');
    expect(friendly.retryable).toBe(true);
  });

  it('classifies generic fetch failures as temporary RPC errors', () => {
    const friendly = describeError(new Error('fetch failed'));
    expect(friendly.title).toBe('RPC briefly unreachable');
    expect(friendly.retryable).toBe(true);
  });

  it('classifies Cloudflare 502 / CORS blips as temporary RPC errors', () => {
    const corsMsg =
      'Failed to fetch: Response to preflight request doesn\'t pass access control check: ' +
      'No \'Access-Control-Allow-Origin\' header is present on the requested resource. ' +
      'net::ERR_FAILED 502 Bad Gateway';
    const friendly = describeError(new Error(corsMsg));
    expect(friendly.title).toBe('RPC briefly unreachable');
    expect(friendly.retryable).toBe(true);
  });

  it('classifies the exact console failure as temporary RPC errors', () => {
    // Real error pair from the browser console during Request Evaluation:
    // POST https://studio.genlayer.com/api net::ERR_FAILED 502 (Bad Gateway)
    const friendly = describeError(
      new Error('GenLayer RPC error (eth_getTransactionByHash): Failed to fetch'),
    );
    expect(friendly.title).toBe('RPC briefly unreachable');
    expect(friendly.retryable).toBe(true);
  });
});

describe('detectConsensusFailure', () => {
  it('flags the live NO_MAJORITY / leader-crash receipt', () => {
    const failure = detectConsensusFailure({
      statusName: 'ACCEPTED',
      resultName: 'NO_MAJORITY',
      lastLeader: 'genvm_crash_handler',
      lastRound: { votesCommitted: '0', votesRevealed: '0' },
    });
    expect(failure).not.toBeNull();
    expect(failure?.result).toBe('NO_MAJORITY');
    expect(failure?.votesCommitted).toBe(0);
    expect(failure?.lastLeader).toBe('genvm_crash_handler');
  });

  it('accepts MAJORITY_AGREE / AGREE receipts', () => {
    expect(detectConsensusFailure({ resultName: 'MAJORITY_AGREE' })).toBeNull();
    expect(detectConsensusFailure({ resultName: 'AGREE' })).toBeNull();
    expect(detectConsensusFailure({ result: 6 })).toBeNull();
    expect(detectConsensusFailure({ result: 1 })).toBeNull();
  });

  it('flags every non-agreeing outcome', () => {
    for (const result of ['NO_MAJORITY', 'MAJORITY_DISAGREE', 'DISAGREE', 'TIMEOUT', 'DETERMINISTIC_VIOLATION', 'IDLE']) {
      expect(detectConsensusFailure({ resultName: result })?.result).toBe(result);
    }
  });

  it('returns null when the node omits the result (cannot prove failure)', () => {
    expect(detectConsensusFailure({ statusName: 'ACCEPTED' })).toBeNull();
    expect(detectConsensusFailure(null)).toBeNull();
  });
});

describe('isTransientRpcWaitError', () => {
  it('treats the console CORS/502 pair as transient', () => {
    expect(
      isTransientRpcWaitError(
        'GenLayer RPC error (eth_getTransactionByHash): Failed to fetch',
      ),
    ).toBe(true);
    expect(
      isTransientRpcWaitError(
        'POST https://studio.genlayer.com/api net::ERR_FAILED 502 (Bad Gateway)',
      ),
    ).toBe(true);
  });

  it('treats indexing lag right after submission as transient', () => {
    expect(isTransientRpcWaitError('Transaction not found: 0xabc')).toBe(true);
  });

  it('does NOT treat wait-budget expiry as transient', () => {
    // The SDK's definitive timeout: waiting longer is pointless, it means the
    // tx genuinely needs more time (→ TransactionPendingError path).
    expect(
      isTransientRpcWaitError(
        'Timed out waiting for transaction 0xabc to reach status "FINALIZED" (current status: 1).',
      ),
    ).toBe(false);
  });

  it('does not classify execution failures as transient', () => {
    expect(isTransientRpcWaitError('The on-chain contract failed while running "request_evaluation".')).toBe(false);
  });
});
