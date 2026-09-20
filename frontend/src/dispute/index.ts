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
  return !['OPEN', 'VERDICT', 'CLOSED', 'APPEALED'].includes(status);
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

const PHASE = {
  evidenceCollection: STATUS_INDEX.EVIDENCE_COLLECTION,
  investigation: STATUS_INDEX.INVESTIGATION,
  deliberation: STATUS_INDEX.DELIBERATION,
  adversarialReview: STATUS_INDEX.ADVERSARIAL_REVIEW,
  settlement: STATUS_INDEX.SETTLEMENT,
  closed: STATUS_INDEX.CLOSED,
};

interface TimelineInput {
  status: string;
  createdAt: bigint;
  evidenceCount: number;
  latestEvidenceTime?: bigint;
  consensusCount: number;
  hasVerdict: boolean;
  verdictLabel?: string;
  verdictTime?: bigint;
}

/**
 * Builds a dispute timeline from real on-chain state. Each phase is marked
 * complete only once the status has advanced past it.
 */
export function buildTimeline(input: TimelineInput): TimelineEntry[] {
  const rank = statusRank(input.status);

  const steps: { done: boolean; label: string; time?: string }[] = [
    {
      done: true,
      label: 'Dispute created by claimant',
      time: formatTime(input.createdAt),
    },
    {
      done: rank >= PHASE.evidenceCollection,
      label:
        input.evidenceCount > 0
          ? `Evidence recorded (${input.evidenceCount} item${input.evidenceCount === 1 ? '' : 's'})`
          : 'Evidence collection open (no items submitted)',
      time: input.latestEvidenceTime ? formatTime(input.latestEvidenceTime) : undefined,
    },
    { done: rank >= PHASE.investigation, label: 'Investigation started' },
    { done: rank >= PHASE.deliberation, label: 'Deliberation started' },
    { done: rank >= PHASE.adversarialReview, label: 'Adversarial review started' },
    {
      done: input.consensusCount > 0,
      label: `Consensus submissions recorded (${input.consensusCount})`,
    },
    {
      done: input.hasVerdict,
      label: input.verdictLabel ? `Verdict finalized: ${input.verdictLabel}` : 'Verdict finalized',
      time: input.verdictTime ? formatTime(input.verdictTime) : undefined,
    },
    { done: rank >= PHASE.settlement, label: 'Settlement executed' },
    { done: rank >= PHASE.closed, label: 'Dispute closed' },
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
