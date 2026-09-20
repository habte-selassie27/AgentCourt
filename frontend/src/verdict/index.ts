/**
 * Verdict domain utilities: colors, labels, confidence helpers.
 */

import { CONFIDENCE_DENOMINATOR } from '../sdk';

// ---------------------------------------------------------------------------
// Verdict constants
// ---------------------------------------------------------------------------

export const VERDICTS = ['NONE', 'TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE', 'REVIEW'] as const;

export type Verdict = (typeof VERDICTS)[number];

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Semantic color for each verdict outcome. */
export const VERDICT_COLORS: Record<string, string> = {
  TRUE: 'var(--success)',
  FALSE: 'var(--danger)',
  MISLEADING: 'var(--warning)',
  UNVERIFIABLE: 'var(--text-secondary)',
  REVIEW: 'var(--info)',
};

/** CSS color for a verdict badge. */
export function verdictColor(verdict: string): string {
  return VERDICT_COLORS[verdict] ?? 'var(--text-primary)';
}

/** Short icon character for a verdict. */
export function verdictIcon(verdict: string): string {
  switch (verdict) {
    case 'TRUE': return 'Y';
    case 'FALSE': return 'N';
    case 'MISLEADING': return '~';
    case 'UNVERIFIABLE': return '?';
    case 'REVIEW': return 'R';
    default: return '-';
  }
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/** Convert basis-points confidence to a 0-100 percentage. */
export function confidencePercent(confidence: bigint): number {
  return Math.round((Number(confidence) / CONFIDENCE_DENOMINATOR) * 100);
}

/** Human-readable confidence level string. */
export function confidenceLevel(confidence: bigint): string {
  const pct = confidencePercent(confidence);
  if (pct >= 90) return 'High';
  if (pct >= 70) return 'Medium';
  if (pct >= 50) return 'Low';
  return 'Very Low';
}

// ---------------------------------------------------------------------------
// Evaluator consensus helpers
// ---------------------------------------------------------------------------

export interface EvaluatorRecord {
  id: string;
  verdict: string;
  confidence: number;
  reasoningHash: string;
  timestamp: string;
  evidenceIds?: string[];
}

export interface ConsensusBreakdown {
  /** Count per verdict string. */
  counts: Record<string, number>;
  /** Fraction of evaluators aligned with the majority verdict. */
  agreementRatio: number;
  /** The majority verdict string (or undefined if no evaluators). */
  majorityVerdict: string | undefined;
  /** Number of distinct verdict strings produced. */
  distinctVerdicts: number;
  /** True when more than one verdict was produced. */
  disagreementDetected: boolean;
}

/** Compute consensus breakdown from evaluator records. */
export function computeConsensus(evaluators: EvaluatorRecord[]): ConsensusBreakdown {
  if (evaluators.length === 0) {
    return {
      counts: {},
      agreementRatio: 0,
      majorityVerdict: undefined,
      distinctVerdicts: 0,
      disagreementDetected: false,
    };
  }

  const counts: Record<string, number> = {};
  for (const e of evaluators) {
    counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const majorityVerdict = sorted[0]?.[0] ?? 'NONE';
  const agreementRatio = sorted[0] ? sorted[0][1] / evaluators.length : 0;

  return {
    counts,
    agreementRatio,
    majorityVerdict,
    distinctVerdicts: Object.keys(counts).length,
    disagreementDetected: Object.keys(counts).length > 1,
  };
}

/** Build a human-readable reasoning summary from consensus data. */
export function buildConsensusSummary(
  evaluators: EvaluatorRecord[],
  breakdown: ConsensusBreakdown,
  finalVerdict?: string,
  finalConfidence?: number,
  reviewRequired?: boolean,
): string {
  const lines = [
    `Recorded from ${evaluators.length} on-chain consensus submission${evaluators.length === 1 ? '' : 's'}`,
    `Verdict breakdown: ${JSON.stringify(breakdown.counts)}`,
    `Agreement ratio: ${(breakdown.agreementRatio * 100).toFixed(1)}%`,
  ];

  if (finalVerdict !== undefined && finalConfidence !== undefined) {
    lines.push(`Final verdict: ${finalVerdict} at ${finalConfidence}% confidence`);
  }

  lines.push(`Review required: ${reviewRequired ? 'YES' : 'NO'}`);

  return lines.join('\n');
}
