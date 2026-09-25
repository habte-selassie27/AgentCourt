import { AgentCourt } from './agentcourt';

let instance: AgentCourt | null = null;

export function getCourt(): AgentCourt {
  if (!instance) {
    instance = new AgentCourt({
      rpcUrl: import.meta.env.VITE_RPC_URL || 'https://studio.genlayer.com/api',
      coreAddress: import.meta.env.VITE_AGENTCOURT_CORE || '0x0000000000000000000000000000000000000000',
      resolutionManagerAddress: import.meta.env.VITE_RESOLUTION_MANAGER || '0x0000000000000000000000000000000000000000',
      chainId: Number(import.meta.env.VITE_CHAIN_ID) || 61999,
    });
  }
  return instance;
}

export { AgentCourt, CONFIDENCE_DENOMINATOR } from './agentcourt';
export { describeError } from './errors';
export { ConsensusFailedError, GENLAYER_EXPLORER_URL, TransactionPendingError, explorerTxUrl } from './genlayer';
export type { FriendlyError } from './errors';
export type {
  ConsensusRecord,
  DisputeDetailData,
  DisputeEvidence,
  DisputeRecord,
  EvaluationRecord,
  EvaluationAdversarial,
  EvaluationFetch,
  EvaluationConsensus,
  TxLink,
  VerdictRecord,
} from './agentcourt';
export type {
  Dispute,
  Evidence,
  VerdictResult,
  Appeal,
  CreateDisputeParams,
  SubmitEvidenceParams,
  Verdict,
  SettlementAction,
  ClaimType,
  EvidenceType,
  DisputeStatus,
} from './types';
