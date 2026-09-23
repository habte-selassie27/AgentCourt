/**
 * Dispute domain utilities: formatting, status checks, and lifecycle helpers.
 */

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

export const DISPUTE_STATUSES = [
  'NONE',
  'OPEN',
  'EVIDENCE_COLLECTION',
  'INVESTIGATION',
  'DELIBERATION',
  'ADVERSARIAL_REVIEW',
  'CONSENSUS',
  'VERDICT',
  'SETTLEMENT',
  'CLOSED',
  'APPEALED',
  'EVALUATION_PENDING',
  'EVALUATION_FAILED',
  'INCONCLUSIVE',
  'DISPUTED',
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** Index of each lifecycle phase, used for timeline ranking. */
export const STATUS_INDEX: Record<DisputeStatus, number> = Object.fromEntries(
  DISPUTE_STATUSES.map((s, i) => [s, i]),
) as Record<DisputeStatus, number>;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format a bigint wei value to human-readable GEN with 4 decimals. */
export function formatStake(wei: bigint): string {
  const gen = Number(wei) / 1e18;
  return `${gen.toFixed(4)} GEN`;
}

/** Format a unix timestamp (seconds) to a locale time string. */
export function formatTime(ts: bigint): string {
  if (ts === 0n) return '--:--';
  return new Date(Number(ts) * 1000).toLocaleTimeString();
}

/** Format a unix timestamp (seconds) to a full locale date-time string. */
export function formatDateTime(ts: bigint): string {
  if (ts === 0n) return '--';
  return new Date(Number(ts) * 1000).toLocaleString();
}

/** Shorten an Ethereum address to `0x1234...5678`. */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || '-';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Shorten any hex string to 8…6 characters. */
export function shortHex(value: string): string {
  if (!value) return '-';
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

/** Generate a dispute display ID like `AC-000123`. */
export function disputeIdLabel(id: bigint): string {
  return `AC-${id.toString().padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/** CSS class string for a dispute status badge. */
export function getStatusClass(status: string): string {
  return `status-badge status-${status}`;
}

/** Rank a status in the lifecycle; unknown statuses rank as NONE (0). */
export function statusRank(status: string): number {
  const idx = DISPUTE_STATUSES.indexOf(status as DisputeStatus);
  return idx === -1 ? 0 : idx;
}

/** Returns true if the dispute is still in an active (non-terminal) state. */
export function isActive(status: string): boolean {
  return !['CLOSED', 'VERDICT'].includes(status);
}

/** Returns true if the dispute is terminal. */
export function isResolved(status: string): boolean {
  return status === 'VERDICT' || status === 'CLOSED';
}

// ---------------------------------------------------------------------------
// Timeline builder
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  time: string;
  label: string;
  completed: boolean;
  active: boolean;
}

interface TimelineInput {
  status: string;
  createdAt: bigint;
  evidenceCount: number;
  latestEvidenceTime?: bigint;
  consensusCount: number;
  hasVerdict: boolean;
  verdictLabel?: string;
  verdictTime?: bigint;
  evaluationState?: string | null;
}

/**
 * Builds a dispute timeline from real on-chain state, including evaluation
 * outcomes (pending / consensus / inconclusive / disputed / failed).
 */
export function buildTimeline(input: TimelineInput): TimelineEntry[] {
  const status = input.status;
  const rank = statusRank(status);

  const steps: { done: boolean; label: string; time?: string }[] = [
    {
      done: true,
      label: 'Dispute created by claimant',
      time: formatTime(input.createdAt),
    },
    {
      done: rank >= STATUS_INDEX.EVIDENCE_COLLECTION,
      label:
        input.evidenceCount > 0
          ? `Evidence recorded (${input.evidenceCount} item${input.evidenceCount === 1 ? '' : 's'})`
          : 'Evidence collection open (no items submitted)',
      time: input.latestEvidenceTime ? formatTime(input.latestEvidenceTime) : undefined,
    },
    { done: rank >= STATUS_INDEX.INVESTIGATION || rank >= STATUS_INDEX.CONSENSUS, label: 'Investigation started' },
    {
      done:
        status === 'CONSENSUS' ||
        status === 'INCONCLUSIVE' ||
        status === 'DISPUTED' ||
        status === 'EVALUATION_FAILED' ||
        input.hasVerdict ||
        rank >= STATUS_INDEX.CONSENSUS,
      label:
        status === 'EVALUATION_FAILED'
          ? 'Evaluation failed (fail-closed)'
          : status === 'INCONCLUSIVE'
            ? 'Evaluation incomplete → INCONCLUSIVE'
            : status === 'DISPUTED'
              ? 'Evaluator disagreement → DISPUTED'
              : status === 'CONSENSUS' || input.hasVerdict
                ? 'Independent evaluators + adversarial review completed'
                : 'Nondeterministic evaluation pending',
    },
    {
      done:
        status === 'CONSENSUS' || input.hasVerdict || rank >= STATUS_INDEX.CONSENSUS,
      label:
        input.consensusCount > 0
          ? `Validator-consensus evaluation recorded (${input.consensusCount} evaluators)`
          : 'Consensus evaluation',
    },
    {
      done: input.hasVerdict,
      label: input.verdictLabel ? `Verdict finalized: ${input.verdictLabel}` : 'Verdict finalized (derived, not caller-supplied)',
      time: input.verdictTime ? formatTime(input.verdictTime) : undefined,
    },
    { done: rank >= STATUS_INDEX.SETTLEMENT || status === 'CLOSED', label: 'Settlement executed' },
    { done: status === 'CLOSED', label: 'Dispute closed' },
  ];

  const firstPending = steps.findIndex((s) => !s.done);

  return steps.map((step, i) => ({
    time: step.time ?? '--:--',
    label: step.label,
    completed: step.done,
    active: i === firstPending,
  }));
}

// ---------------------------------------------------------------------------
// Claim type helpers
// ---------------------------------------------------------------------------

export const CLAIM_TYPE_LABELS: Record<string, string> = {
  DELIVERY_FAILURE: 'Delivery Failure',
  PAYMENT_FAILURE: 'Payment Failure',
  PERFORMANCE_FAILURE: 'Performance Failure',
  DATA_QUALITY: 'Data Quality',
  MARKETPLACE_VIOLATION: 'Marketplace Violation',
  AGENT_CONTRACT_BREACH: 'Agent Contract Breach',
  ORACLE_MALFUNCTION: 'Oracle Malfunction',
  ESCROW_DISPUTE: 'Escrow Dispute',
  CUSTOM: 'Custom',
};

/** Human-friendly label for a claim type enum value. */
export function claimTypeLabel(claimType: string): string {
  return CLAIM_TYPE_LABELS[claimType] ?? claimType.replace(/_/g, ' ');
}
