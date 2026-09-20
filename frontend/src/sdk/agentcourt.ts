// @ts-nocheck
import { BrowserProvider, Contract, JsonRpcProvider, Signer } from 'ethers';
import { ContractExecutionError, GenLayerClient } from './genlayer';

// ---------------------------------------------------------------------------
// ABIs — writes go through AgentCourtCore, reads go direct to DisputeRegistry
// ---------------------------------------------------------------------------

const CORE_WRITE_ABI = [
  'function createDispute(address respondent, bytes32 agreementHash, uint8 claimType, string description, uint256 stake, uint256 deadline) payable returns (uint256)',
  'function submitEvidence(uint256 disputeId, uint8 evidenceType, string source, string refUri, bytes32 contentHash, string description) returns (uint256)',
  'function startInvestigation(uint256 disputeId)',
  'function startDeliberation(uint256 disputeId)',
  'function startAdversarialReview(uint256 disputeId)',
  'function finalizeVerdict(uint256 disputeId, uint8 verdict, uint256 confidence, bytes32 reasoningHash, uint8 resolution, bool reviewRequired)',
  'function openAppeal(uint256 disputeId, string reason)',
  'function executeSettlement(uint256 disputeId)',
  'event DisputeCreated(uint256 indexed disputeId, address indexed claimant, address indexed respondent)',
  'event EvidenceSubmitted(uint256 indexed disputeId, uint256 indexed evidenceId, address indexed submitter, uint8 evidenceType)',
  'event VerdictFinalized(uint256 indexed disputeId, uint8 verdict, uint8 resolution)',
];

const DISPUTE_REGISTRY_ABI = [
  'function getDisputeCount() view returns (uint256)',
  'function getDispute(uint256 disputeId) view returns (tuple(uint256 id, address claimant, address respondent, bytes32 agreementHash, uint8 claimType, uint256 stake, uint256 createdAt, uint256 deadline, uint8 status, string description))',
  'function getEvidence(uint256 evidenceId) view returns (tuple(uint256 id, uint256 disputeId, uint8 evidenceType, string source, string refUri, bytes32 contentHash, uint256 timestamp, address submitter, string description))',
  'function getDisputeEvidenceIds(uint256 disputeId) view returns (uint256[])',
  'function exists(uint256 disputeId) view returns (bool)',
  'function getEvidenceRecord(uint256 evidenceId) view returns (tuple(tuple(uint256 id, uint256 disputeId, uint8 evidenceType, string source, string refUri, bytes32 contentHash, uint256 timestamp, address submitter, string description) evidence, bool verified, uint256 verificationTimestamp, string[] crossReferences))',
  'function isVerified(uint256 evidenceId) view returns (bool)',
  'function getVerdict(uint256 disputeId) view returns (tuple(uint256 disputeId, uint8 verdict, uint256 confidence, bytes32 reasoningHash, uint256[] evidenceIds, uint8 resolution, bool reviewRequired, uint256 finalizedAt))',
  'function hasVerdict(uint256 disputeId) view returns (bool)',
  'function getConsensusRecords(uint256 disputeId) view returns (tuple(uint256 disputeId, address evaluator, uint8 verdict, uint256 confidence, bytes32 reasoningHash, uint256 timestamp)[])',
  'function getConsensusCount(uint256 disputeId) view returns (uint256)',
];

const RESOLUTION_MANAGER_ABI = [
  'function isSettled(uint256 disputeId) view returns (bool)',
  'function getSettlementNonce(uint256 disputeId) view returns (uint256)',
  'function getAppeal(uint256 appealId) view returns (tuple(uint256 id, uint256 disputeId, address appellant, string reason, uint256 bond, uint256 createdAt, bool resolved, uint256 supersedingVerdict))',
  'function getDisputeAppeals(uint256 disputeId) view returns (uint256[])',
  'function getAppealCount(uint256 disputeId) view returns (uint256)',
];

/** Verdict confidence is stored in basis points: 10000 === 100.00%. */
export const CONFIDENCE_DENOMINATOR = 10000;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface ConsensusRecord {
  disputeId: bigint;
  evaluator: string;
  verdict: string;
  confidence: bigint;
  reasoningHash: string;
  timestamp: bigint;
}

export interface DisputeEvidence {
  id: bigint;
  disputeId: bigint;
  evidenceType: string;
  source: string;
  refUri: string;
  contentHash: string;
  timestamp: bigint;
  submitter: string;
  description: string;
  verified: boolean;
}

export interface DisputeDetailData {
  dispute: DisputeRecord;
  evidence: DisputeEvidence[];
  verdict: VerdictRecord | null;
  consensus: ConsensusRecord[];
}

export interface DisputeRecord {
  id: bigint;
  claimant: string;
  respondent: string;
  agreementHash: string;
  claimType: string;
  stake: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: string;
  description: string;
}

export interface VerdictRecord {
  disputeId: bigint;
  verdict: string;
  confidence: bigint;
  reasoningHash: string;
  evidenceIds: bigint[];
  resolution: string;
  reviewRequired: boolean;
  finalizedAt: bigint;
}

export interface AgentCourtConfig {
  rpcUrl: string;
  privateKey?: string;
  coreAddress: string;
  disputeRegistryAddress: string;
  resolutionManagerAddress: string;
  chainId?: number;
  disputeJudgeAddress?: string;
  evidenceVerifierAddress?: string;
  adversarialReviewerAddress?: string;
  consensusEngineAddress?: string;
}

function statusFromNum(n: number): string {
  return ['NONE','OPEN','EVIDENCE_COLLECTION','INVESTIGATION','DELIBERATION','ADVERSARIAL_REVIEW','CONSENSUS','VERDICT','SETTLEMENT','CLOSED','APPEALED'][n] || 'NONE';
}

function verdictFromNum(n: number): string {
  return ['NONE','TRUE','FALSE','MISLEADING','UNVERIFIABLE','REVIEW'][n] || 'NONE';
}

function claimTypeFromNum(n: number): string {
  return ['DELIVERY_FAILURE','PAYMENT_FAILURE','PERFORMANCE_FAILURE','DATA_QUALITY','MARKETPLACE_VIOLATION','AGENT_CONTRACT_BREACH','ORACLE_MALFUNCTION','ESCROW_DISPUTE','CUSTOM'][n] || 'CUSTOM';
}

function evidenceTypeFromNum(n: number): string {
  return ['ONCHAIN_TRANSACTION','WEB_PAGE','API_RESPONSE','SIGNED_MESSAGE','CONTENT_HASH','CUSTOM'][n] || 'CUSTOM';
}

function settlementFromNum(n: number): string {
  return ['RELEASE_TO_CLAIMANT','RELEASE_TO_RESPONDENT','SPLIT','FREEZE','SLASH','REVIEW'][n] || 'FREEZE';
}

const CLAIM_TYPE_MAP: Record<string, number> = {
  DELIVERY_FAILURE: 0, PAYMENT_FAILURE: 1, PERFORMANCE_FAILURE: 2,
  DATA_QUALITY: 3, MARKETPLACE_VIOLATION: 4, AGENT_CONTRACT_BREACH: 5,
  ORACLE_MALFUNCTION: 6, ESCROW_DISPUTE: 7, CUSTOM: 8,
};

const EVIDENCE_TYPE_MAP: Record<string, number> = {
  ONCHAIN_TRANSACTION: 0, WEB_PAGE: 1, API_RESPONSE: 2,
  SIGNED_MESSAGE: 3, CONTENT_HASH: 4, CUSTOM: 5,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = Contract;

// ---------------------------------------------------------------------------
// Mappers — DisputeRegistry IC returns plain JSON objects with camelCase keys
// ---------------------------------------------------------------------------

function asBig(v: any): bigint {
  return BigInt(v ?? 0);
}

function mapDispute(d: any): DisputeRecord {
  return {
    id: asBig(d?.id),
    claimant: String(d?.claimant ?? ''),
    respondent: String(d?.respondent ?? ''),
    agreementHash: String(d?.agreementHash ?? ''),
    claimType: claimTypeFromNum(Number(d?.claimType ?? 0)),
    stake: asBig(d?.stake),
    createdAt: asBig(d?.createdAt),
    deadline: asBig(d?.deadline),
    status: statusFromNum(Number(d?.status ?? 0)),
    description: String(d?.description ?? ''),
  };
}

function mapEvidence(e: any) {
  return {
    id: asBig(e?.id),
    disputeId: asBig(e?.disputeId),
    evidenceType: evidenceTypeFromNum(Number(e?.evidenceType ?? 0)),
    source: String(e?.source ?? ''),
    refUri: String(e?.refUri ?? ''),
    contentHash: String(e?.contentHash ?? ''),
    timestamp: asBig(e?.timestamp),
    submitter: String(e?.submitter ?? ''),
    description: String(e?.description ?? ''),
  };
}

function mapVerdict(v: any): VerdictRecord {
  return {
    disputeId: asBig(v?.disputeId),
    verdict: verdictFromNum(Number(v?.verdict ?? 0)),
    confidence: asBig(v?.confidence),
    reasoningHash: String(v?.reasoningHash ?? ''),
    evidenceIds: ((v?.evidenceIds ?? []) as any[]).map((x) => asBig(x)),
    resolution: settlementFromNum(Number(v?.resolution ?? 0)),
    reviewRequired: Boolean(v?.reviewRequired),
    finalizedAt: asBig(v?.finalizedAt),
  };
}

function mapConsensus(r: any): ConsensusRecord {
  return {
    disputeId: asBig(r?.disputeId),
    evaluator: String(r?.evaluator ?? ''),
    verdict: verdictFromNum(Number(r?.verdict ?? 0)),
    confidence: asBig(r?.confidence),
    reasoningHash: String(r?.reasoningHash ?? ''),
    timestamp: asBig(r?.timestamp),
  };
}

// Helper to call a dynamic method on an ethers Contract
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callContractMethod(contract: Contract, method: string, ...args: any[]): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return await (contract as any)[method](...args);
}

export class AgentCourt {
  readonly config: AgentCourtConfig;
  private gl: GenLayerClient;
  private provider: JsonRpcProvider;
  private signer: Signer | null = null;
  // Write path: AgentCourtCore (mutations)
  private coreContract: AnyContract;
  // Read path: DisputeRegistry (disputes + evidence + verdicts)
  private disputeRegistry: AnyContract;
  // Resolution path: ResolutionManager (appeals + settlement)
  private resolutionManager: AnyContract;
  private deployedChecked = false;

  constructor(config: AgentCourtConfig) {
    this.config = config;
    this.gl = new GenLayerClient(config.rpcUrl);
    this.provider = new JsonRpcProvider(config.rpcUrl);
    // Reads go through gen_call (see readIc); the ethers contracts below are
    // only used for the write path, so tolerate placeholder addresses here.
    this.coreContract = new Contract(config.coreAddress || ZERO_ADDRESS, CORE_WRITE_ABI, this.provider) as AnyContract;
    this.disputeRegistry = new Contract(config.disputeRegistryAddress || ZERO_ADDRESS, DISPUTE_REGISTRY_ABI, this.provider) as AnyContract;
    this.resolutionManager = new Contract(config.resolutionManagerAddress || ZERO_ADDRESS, RESOLUTION_MANAGER_ABI, this.provider) as AnyContract;
  }

  async connectWallet(ethereum: any): Promise<string> {
    const browserProvider = new BrowserProvider(ethereum);
    this.signer = await browserProvider.getSigner();
    // Only the write path (AgentCourtCore) is rewired to the wallet's signer.
    // Read contracts stay on the JsonRpcProvider so the dashboard keeps reading
    // GenLayer state even when the connected wallet is on a different network
    // (otherwise reads return empty data and fail ABI decoding with BAD_DATA).
    this.coreContract = new Contract(this.config.coreAddress, CORE_WRITE_ABI, this.signer) as AnyContract;
    return this.signer.getAddress();
  }

  getSigner(): Signer | null {
    return this.signer;
  }

  private requireSigner(): Signer {
    if (!this.signer) throw new Error('Wallet not connected');
    return this.signer;
  }

  async createDispute(params: {
    respondent: string;
    agreementHash: string;
    claimType: string;
    description: string;
    stake: bigint;
    deadline: bigint;
  }): Promise<bigint> {
    this.requireSigner();

    const iface = this.coreContract.interface;
    const calldata = iface.encodeFunctionData('createDispute', [
      params.respondent,
      params.agreementHash,
      CLAIM_TYPE_MAP[params.claimType] ?? 0,
      params.description,
      params.stake,
      params.deadline,
    ]);

    const tx = await this.signer!.sendTransaction({
      to: this.config.coreAddress,
      data: calldata,
      value: params.stake,
    });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction mined:', receipt?.hash);

    if (receipt) {
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'DisputeCreated') {
            return BigInt(parsed.args[0]);
          }
        } catch { /* skip */ }
      }
    }

    return this.getDisputeCount();
  }

  /**
   * Read a view method from the DisputeRegistry IC via gen_call.
   * The registry is a GenLayer Python contract — ethers/eth_call returns
   * placeholder data for it, so ALL reads must go through the JSON-RPC.
   */
  private async readIc<T>(method: string, args: unknown[]): Promise<T> {
    const res = await this.gl.genCallRaw<T>(this.config.disputeRegistryAddress, method, args);
    if (!res.ok || res.data === undefined) {
      if (res.error?.kind === 'execution') {
        throw new ContractExecutionError(method, res.error.executionResult ?? res.error.message);
      }
      throw new Error(res.error?.message ?? `Read "${method}" failed.`);
    }
    return res.data;
  }

  private async ensureDeployed(): Promise<void> {
    if (this.deployedChecked) return;
    // GenLayer ICs are Python-based — a cheap read verifies the contract responds.
    await this.readIc<number>('get_dispute_count', []);
    this.deployedChecked = true;
  }

  // ---------------------------------------------------------------------------
  // Read methods — all go through DisputeRegistry (consolidated)
  // ---------------------------------------------------------------------------

  async getDispute(disputeId: bigint): Promise<DisputeRecord> {
    await this.ensureDeployed();
    const d = await this.readIc<any>('get_dispute', [Number(disputeId)]);
    if (d === null || d === undefined) {
      throw new Error(`Dispute #${disputeId} does not exist on this chain.`);
    }
    return mapDispute(d);
  }

  async getEvidence(evidenceId: bigint) {
    const e = await this.readIc<any>('get_evidence', [Number(evidenceId)]);
    return mapEvidence(e);
  }

  async hasVerdict(disputeId: bigint): Promise<boolean> {
    await this.ensureDeployed();
    return Boolean(await this.readIc<unknown>('has_verdict', [Number(disputeId)]));
  }

  async getVerdict(disputeId: bigint): Promise<VerdictRecord | null> {
    if (!(await this.hasVerdict(disputeId))) return null;

    const v = await this.readIc<any>('get_verdict', [Number(disputeId)]);
    if (!v) return null;
    return mapVerdict(v);
  }

  async getDisputeEvidenceIds(disputeId: bigint): Promise<bigint[]> {
    await this.ensureDeployed();
    const ids = await this.readIc<any[]>('get_dispute_evidence_ids', [Number(disputeId)]);
    return (ids ?? []).map((id) => asBig(id));
  }

  async isEvidenceVerified(evidenceId: bigint): Promise<boolean> {
    try {
      return Boolean(await this.readIc<unknown>('is_verified', [Number(evidenceId)]));
    } catch {
      return false;
    }
  }

  async getConsensusRecords(disputeId: bigint): Promise<ConsensusRecord[]> {
    await this.ensureDeployed();
    const records = await this.readIc<any[]>('get_consensus_records', [Number(disputeId)]);
    return (records ?? []).map(mapConsensus);
  }

  async getConsensusCount(disputeId: bigint): Promise<bigint> {
    await this.ensureDeployed();
    const count = await this.readIc<number>('get_consensus_count', [Number(disputeId)]);
    return BigInt(count ?? 0);
  }

  async loadDisputeDetail(disputeId: bigint): Promise<DisputeDetailData> {
    await this.ensureDeployed();

    const dispute = await this.getDispute(disputeId);
    const evidenceIds = await this.getDisputeEvidenceIds(disputeId);

    const evidence = await Promise.all(
      evidenceIds.map(async (id): Promise<DisputeEvidence> => {
        const e = await this.getEvidence(id);
        return { ...e, verified: await this.isEvidenceVerified(id) };
      }),
    );

    const [verdict, consensus] = await Promise.all([
      this.getVerdict(disputeId),
      this.getConsensusRecords(disputeId),
    ]);

    return { dispute, evidence, verdict, consensus };
  }

  async getDisputeCount(): Promise<bigint> {
    await this.ensureDeployed();
    const count = await this.readIc<number>('get_dispute_count', []);
    return BigInt(count ?? 0);
  }

  async listDisputes(): Promise<DisputeRecord[]> {
    const count = Number(await this.getDisputeCount());
    if (count <= 0) return [];

    const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
    // Drop individual failures so one bad record doesn't blank the whole list.
    const results = await Promise.allSettled(ids.map((id) => this.getDispute(id)));
    return results
      .filter((r): r is PromiseFulfilledResult<DisputeRecord> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  async submitEvidence(params: {
    disputeId: bigint;
    evidenceType: string;
    source: string;
    refUri: string;
    contentHash: string;
    description: string;
  }): Promise<bigint> {
    this.requireSigner();

    const iface = this.coreContract.interface;
    const calldata = iface.encodeFunctionData('submitEvidence', [
      params.disputeId,
      EVIDENCE_TYPE_MAP[params.evidenceType] ?? 0,
      params.source,
      params.refUri,
      params.contentHash,
      params.description,
    ]);

    const tx = await this.signer!.sendTransaction({
      to: this.config.coreAddress,
      data: calldata,
    });
    const receipt = await tx.wait();

    if (receipt) {
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'EvidenceSubmitted') {
            return BigInt(parsed.args[1]);
          }
        } catch { /* skip */ }
      }
    }

    const ids = await this.getDisputeEvidenceIds(params.disputeId);
    if (ids.length === 0) {
      throw new Error(
        'EvidenceSubmitted event not found and no evidence is recorded for this dispute.',
      );
    }
    return ids[ids.length - 1];
  }

  async startInvestigation(disputeId: bigint): Promise<void> {
    this.requireSigner();
    const tx = await this.coreContract.startInvestigation(disputeId);
    await tx.wait();
  }

  async startDeliberation(disputeId: bigint): Promise<void> {
    this.requireSigner();
    const tx = await this.coreContract.startDeliberation(disputeId);
    await tx.wait();
  }

  async startAdversarialReview(disputeId: bigint): Promise<void> {
    this.requireSigner();
    const tx = await this.coreContract.startAdversarialReview(disputeId);
    await tx.wait();
  }

  async finalizeVerdict(
    disputeId: bigint,
    verdict: string,
    confidence: bigint,
    reasoningHash: string,
    resolution: string,
    reviewRequired: boolean,
  ): Promise<void> {
    this.requireSigner();
    const verdictNum = ['NONE','TRUE','FALSE','MISLEADING','UNVERIFIABLE','REVIEW'].indexOf(verdict);
    const resolutionNum = ['RELEASE_TO_CLAIMANT','RELEASE_TO_RESPONDENT','SPLIT','FREEZE','SLASH','REVIEW'].indexOf(resolution);
    const tx = await this.coreContract.finalizeVerdict(disputeId, verdictNum, confidence, reasoningHash, resolutionNum, reviewRequired);
    await tx.wait();
  }

  async openAppeal(disputeId: bigint, reason: string): Promise<void> {
    this.requireSigner();
    const tx = await this.coreContract.openAppeal(disputeId, reason);
    await tx.wait();
  }

  async executeSettlement(disputeId: bigint): Promise<void> {
    this.requireSigner();
    const tx = await this.coreContract.executeSettlement(disputeId);
    await tx.wait();
  }

  async waitForVerdict(disputeId: bigint, timeoutMs = 300_000, pollIntervalMs = 5_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const verdict = await this.getVerdict(disputeId);
      if (verdict) return verdict;
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Timeout waiting for verdict on dispute ${disputeId}`);
  }

  // ---------------------------------------------------------------------------
  // Intelligent Contract (IC) calls — GenLayer RPC gen_call / gen_write
  // ---------------------------------------------------------------------------

  private async icCall(method: string, address: string, args: any[]): Promise<any> {
    return this.gl.genCall(address, method, args);
  }

  async judgeDispute(agreement: object, claim: object, evidence: object[]) {
    const addr = this.config.disputeJudgeAddress;
    if (!addr) throw new Error('DisputeJudge address not configured');
    return this.icCall('judge', addr, [agreement, claim, evidence]);
  }

  async verifyEvidence(evidenceList: object[]) {
    const addr = this.config.evidenceVerifierAddress;
    if (!addr) throw new Error('EvidenceVerifier address not configured');
    return this.icCall('verify_batch', addr, [evidenceList]);
  }

  async checkSourceIndependence(sources: object[]) {
    const addr = this.config.evidenceVerifierAddress;
    if (!addr) throw new Error('EvidenceVerifier address not configured');
    return this.icCall('check_source_independence', addr, [sources]);
  }

  async reviewVerdict(
    initialVerdict: string,
    initialConfidence: number,
    agreement: object,
    claim: object,
    evidence: object[],
    supportingIds: string[],
    contradictingIds: string[],
  ) {
    const addr = this.config.adversarialReviewerAddress;
    if (!addr) throw new Error('AdversarialReviewer address not configured');
    return this.icCall('review', addr, [
      initialVerdict, initialConfidence, agreement, claim,
      evidence, supportingIds, contradictingIds,
    ]);
  }

  async buildConsensus(evaluatorResults: object[], adversarialAdjustment: number) {
    const addr = this.config.consensusEngineAddress;
    if (!addr) throw new Error('ConsensusEngine address not configured');
    return this.icCall('build_consensus', addr, [evaluatorResults, adversarialAdjustment]);
  }
}
