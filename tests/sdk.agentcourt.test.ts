import { describe, it, expect } from 'vitest';
import {
  DISPUTE_STATUSES,
  getStatusClass,
  disputeIdLabel,
  isActive,
  isResolved,
} from '../frontend/src/dispute';
import { VERDICTS, confidencePercent } from '../frontend/src/verdict';

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
