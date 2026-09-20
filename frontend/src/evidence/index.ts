/**
 * Evidence domain utilities: type colors, formatting, and verification helpers.
 */

// ---------------------------------------------------------------------------
// Type constants
// ---------------------------------------------------------------------------

export const EVIDENCE_TYPES = [
  'ONCHAIN_TRANSACTION',
  'WEB_PAGE',
  'API_RESPONSE',
  'SIGNED_MESSAGE',
  'CONTENT_HASH',
  'CUSTOM',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Semantic color for each evidence type. */
export const EVIDENCE_TYPE_COLORS: Record<string, string> = {
  ONCHAIN_TRANSACTION: 'var(--success)',
  WEB_PAGE: 'var(--info)',
  API_RESPONSE: 'var(--accent)',
  SIGNED_MESSAGE: 'var(--warning)',
  CONTENT_HASH: 'var(--text-secondary)',
  CUSTOM: 'var(--text-secondary)',
};

/** CSS color for an evidence type badge. */
export function evidenceTypeColor(type: string): string {
  return EVIDENCE_TYPE_COLORS[type] ?? 'var(--text-secondary)';
}

/** Human-readable label for an evidence type. */
export function evidenceTypeLabel(type: string): string {
  return type.replace(/_/g, ' ');
}

/** Generate an evidence display ID like `EVID-001`. */
export function evidenceIdLabel(id: bigint): string {
  return `EVID-${id.toString().padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Verification helpers
// ---------------------------------------------------------------------------

export interface EvidenceStats {
  total: number;
  verified: number;
  uniqueSources: number;
  crossReferenced: number;
}

/** Compute summary statistics from an evidence list. */
export function computeEvidenceStats(
  items: { verified: boolean; source: string; crossReferences: string[] }[],
): EvidenceStats {
  return {
    total: items.length,
    verified: items.filter((e) => e.verified).length,
    uniqueSources: new Set(items.map((e) => e.source)).size,
    crossReferenced: items.filter((e) => e.crossReferences.length > 0).length,
  };
}

// ---------------------------------------------------------------------------
// Evidence interface for explorer components
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  id: string;
  type: string;
  source: string;
  reference: string;
  hash: string;
  description: string;
  timestamp: string;
  submitter: string;
  verified: boolean;
  relevance: string;
  crossReferences: string[];
}
