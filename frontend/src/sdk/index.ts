import { AgentCourt } from './agentcourt';

let instance: AgentCourt | null = null;

export function getCourt(): AgentCourt {
  if (!instance) {
    instance = new AgentCourt({
      rpcUrl: import.meta.env.VITE_RPC_URL || 'https://studio.genlayer.com/api',
      coreAddress: import.meta.env.VITE_AGENTCOURT_CORE || '0x1201eF62b96133c652c668e200C096D16BcaD0CF',
      disputeRegistryAddress: import.meta.env.VITE_DISPUTE_REGISTRY || '0x57802A80B38c68a7EbE814F4249a8Ac6768319b4',
      resolutionManagerAddress: import.meta.env.VITE_RESOLUTION_MANAGER || '0xa8c7C20Edd5db93067203939Ad6a85eDb52B5F55',
      chainId: Number(import.meta.env.VITE_CHAIN_ID) || 61999,
      disputeJudgeAddress: import.meta.env.VITE_DISPUTE_JUDGE || '0x9CAB521b93549C314E17a7Ed8ddEeA6BAd8f2662',
      evidenceVerifierAddress: import.meta.env.VITE_EVIDENCE_VERIFIER || '0x913DE37be72E2D6C4Ad10AD853753C0a4cB2DfFE',
      adversarialReviewerAddress: import.meta.env.VITE_ADVERSARIAL_REVIEWER || '0xFB94C2A452ab97d45165B967715df988283C00A1',
      consensusEngineAddress: import.meta.env.VITE_CONSENSUS_ENGINE || '0xa0619c616895110FCa35f94136B46f60225c8974',
    });
  }
  return instance;
}

export { AgentCourt, CONFIDENCE_DENOMINATOR } from './agentcourt';
export type {
  ConsensusRecord,
  DisputeDetailData,
  DisputeEvidence,
  DisputeRecord,
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
