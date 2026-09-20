export type DisputeStatus =
  | 'NONE'
  | 'OPEN'
  | 'EVIDENCE_COLLECTION'
  | 'INVESTIGATION'
  | 'DELIBERATION'
  | 'ADVERSARIAL_REVIEW'
  | 'CONSENSUS'
  | 'VERDICT'
  | 'SETTLEMENT'
  | 'CLOSED'
  | 'APPEALED';

export type Verdict =
  | 'NONE'
  | 'TRUE'
  | 'FALSE'
  | 'MISLEADING'
  | 'UNVERIFIABLE'
  | 'REVIEW';

export type ClaimType =
  | 'DELIVERY_FAILURE'
  | 'PAYMENT_FAILURE'
  | 'PERFORMANCE_FAILURE'
  | 'DATA_QUALITY'
  | 'MARKETPLACE_VIOLATION'
  | 'AGENT_CONTRACT_BREACH'
  | 'ORACLE_MALFUNCTION'
  | 'ESCROW_DISPUTE'
  | 'CUSTOM';

export type EvidenceType =
  | 'ONCHAIN_TRANSACTION'
  | 'WEB_PAGE'
  | 'API_RESPONSE'
  | 'SIGNED_MESSAGE'
  | 'CONTENT_HASH'
  | 'CUSTOM';

export type SettlementAction =
  | 'RELEASE_TO_CLAIMANT'
  | 'RELEASE_TO_RESPONDENT'
  | 'SPLIT'
  | 'FREEZE'
  | 'SLASH'
  | 'REVIEW';

export interface Dispute {
  id: bigint;
  claimant: `0x${string}`;
  respondent: `0x${string}`;
  agreementHash: `0x${string}`;
  claimType: ClaimType;
  stake: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: DisputeStatus;
  description: string;
}

export interface Evidence {
  id: bigint;
  disputeId: bigint;
  evidenceType: EvidenceType;
  source: string;
  reference: string;
  contentHash: `0x${string}`;
  timestamp: bigint;
  submitter: `0x${string}`;
  description: string;
}

export interface VerdictResult {
  disputeId: bigint;
  verdict: Verdict;
  confidence: bigint;
  reasoningHash: `0x${string}`;
  evidenceIds: bigint[];
  resolution: SettlementAction;
  reviewRequired: boolean;
  finalizedAt: bigint;
}

export interface Appeal {
  id: bigint;
  disputeId: bigint;
  appellant: `0x${string}`;
  reason: string;
  bond: bigint;
  createdAt: bigint;
  resolved: boolean;
  supersedingVerdict: Verdict;
}

export interface CreateDisputeParams {
  respondent: `0x${string}`;
  agreementHash: `0x${string}`;
  claimType: ClaimType;
  description: string;
  stake: bigint;
  deadline: bigint;
}

export interface SubmitEvidenceParams {
  disputeId: bigint;
  evidenceType: EvidenceType;
  source: string;
  reference: string;
  contentHash: `0x${string}`;
  description: string;
}
