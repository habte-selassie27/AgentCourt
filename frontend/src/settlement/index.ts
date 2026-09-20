/**
 * Settlement domain utilities: resolution labels, action helpers.
 */

// ---------------------------------------------------------------------------
// Resolution constants
// ---------------------------------------------------------------------------

export const SETTLEMENT_ACTIONS = [
  'RELEASE_TO_CLAIMANT',
  'RELEASE_TO_RESPONDENT',
  'SPLIT',
  'FREEZE',
  'SLASH',
  'REVIEW',
] as const;

export type SettlementAction = (typeof SETTLEMENT_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

export const RESOLUTION_LABELS: Record<string, string> = {
  RELEASE_TO_CLAIMANT: 'Release funds to claimant',
  RELEASE_TO_RESPONDENT: 'Release funds to respondent',
  SPLIT: 'Split escrow between parties',
  FREEZE: 'Freeze funds pending review',
  SLASH: 'Slash bond',
  REVIEW: 'Escalate for manual review',
};

export function resolutionLabel(resolution: string): string {
  return RESOLUTION_LABELS[resolution] ?? resolution;
}

// ---------------------------------------------------------------------------
// CSS color helpers
// ---------------------------------------------------------------------------

export const RESOLUTION_COLORS: Record<string, string> = {
  RELEASE_TO_CLAIMANT: 'var(--success)',
  RELEASE_TO_RESPONDENT: 'var(--danger)',
  SPLIT: 'var(--warning)',
  FREEZE: 'var(--info)',
  SLASH: 'var(--danger)',
  REVIEW: 'var(--text-secondary)',
};

export function resolutionColor(resolution: string): string {
  return RESOLUTION_COLORS[resolution] ?? 'var(--text-secondary)';
}

// ---------------------------------------------------------------------------
// Settlement status
// ---------------------------------------------------------------------------

export const SETTLEMENT_STATUSES = [
  'NONE',
  'PENDING',
  'EXECUTED',
  'FAILED',
  'DISPUTED',
] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  NONE: 'No settlement',
  PENDING: 'Pending',
  EXECUTED: 'Executed',
  FAILED: 'Failed',
  DISPUTED: 'Disputed',
};

export function settlementStatusLabel(status: string): string {
  return SETTLEMENT_STATUS_LABELS[status] ?? status;
}

// ---------------------------------------------------------------------------
// Adversarial review helpers
// ---------------------------------------------------------------------------

export interface Challenge {
  type: string;
  description: string;
  severity: number;
  evidenceIds: string[];
  affectsVerdict: boolean;
}

/** Color for a severity value (0-1 scale). */
export function severityColor(severity: number): string {
  if (severity >= 0.7) return 'var(--danger)';
  if (severity >= 0.4) return 'var(--warning)';
  return 'var(--text-secondary)';
}

export interface AdversarialResult {
  challenges: Challenge[];
  verdictUpheld: boolean;
  confidenceAdjustment: number;
}

/** Derive an adversarial summary from a list of challenges. */
export function summarizeAdversarial(challenges: Challenge[]): AdversarialResult {
  const affectsVerdict = challenges.filter((c) => c.affectsVerdict);
  const avgSeverity =
    challenges.length > 0
      ? challenges.reduce((sum, c) => sum + c.severity, 0) / challenges.length
      : 0;

  return {
    challenges,
    verdictUpheld: affectsVerdict.length === 0,
    confidenceAdjustment: challenges.length === 0 ? 0 : -avgSeverity,
  };
}
