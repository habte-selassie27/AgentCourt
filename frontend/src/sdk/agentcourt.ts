import { ContractExecutionError, GenLayerClient } from './genlayer';

/** Verdict confidence is stored in basis points: 10000 === 100.00%. */
export const CONFIDENCE_DENOMINATOR = 10000;

export interface ConsensusRecord {
  disputeId: bigint;
  evaluator: string;
  verdict: string;
  confidence: bigint;
  reasoningHash: string;
  timestamp: bigint;
  reasoning?: string;
  evidenceIds?: string[];
}

export interface EvaluationAdversarialChallenge {
  type: string;
  description: string;
  severity: number;
  affectsVerdict: boolean;
}

export interface EvaluationAdversarial {
  challenges: EvaluationAdversarialChallenge[];
  verdictUpheld: boolean;
  reasoning: string;
  confidenceAdjustment: number;
}

export interface EvaluationFetch {
  id: string;
  url: string;
  status: string;
  excerpt?: string;
}

export interface EvaluationConsensus {
  state: string;
  majority: string;
  counts: Record<string, number>;
  agreementRatio: number;
  validCount: number;
  finalVerdict: number;
  confidenceBp: number;
  reviewRequired: boolean;
}

export interface EvaluationRecord {
  id: number;
  disputeId: number;
  state: string;
  evaluators: {
    role: string;
    verdict: string;
    confidence: number;
    reasoning: string;
    evidenceUsed: string[];
    contradictions: string[];
    missingInformation: string[];
  }[];
  adversarial: EvaluationAdversarial | null;
  fetches: EvaluationFetch[];
  consensus: EvaluationConsensus;
  ok: boolean;
  error: string | null;
  evaluatedAt: number;
  version: number;
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
  evaluation: EvaluationRecord | null;
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
  coreAddress: string;
  resolutionManagerAddress: string;
  chainId?: number;
}

function statusFromNum(n: number): string {
  return [
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
  ][n] || 'NONE';
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

type Any = unknown;

function asBig(v: Any): bigint {
  return BigInt((v as bigint | number | string | undefined) ?? 0);
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

function mapEvidence(e: any): DisputeEvidence {
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
    verified: Boolean(e?.verified ?? true),
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
    reasoning: r?.reasoning ? String(r.reasoning) : undefined,
    evidenceIds: Array.isArray(r?.evidenceIds) ? r.evidenceIds.map(String) : undefined,
  };
}

function mapEvaluation(e: any): EvaluationRecord | null {
  if (!e) return null;
  return {
    id: Number(e.id ?? 0),
    disputeId: Number(e.disputeId ?? 0),
    state: String(e.state ?? 'EVALUATION_FAILED'),
    evaluators: (e.evaluators ?? []).map((x: any) => ({
      role: String(x.role ?? 'evaluator'),
      verdict: String(x.verdict ?? 'INCONCLUSIVE'),
      confidence: Number(x.confidence ?? 0),
      reasoning: String(x.reasoning ?? ''),
      evidenceUsed: (x.evidenceUsed ?? []).map(String),
      contradictions: (x.contradictions ?? []).map(String),
      missingInformation: (x.missingInformation ?? []).map(String),
    })),
    adversarial: e.adversarial
      ? {
          challenges: (e.adversarial.challenges ?? []).map((c: any) => ({
            type: String(c.type ?? 'assumption'),
            description: String(c.description ?? ''),
            severity: Number(c.severity ?? 0),
            affectsVerdict: Boolean(c.affectsVerdict),
          })),
          verdictUpheld: Boolean(e.adversarial.verdictUpheld),
          reasoning: String(e.adversarial.reasoning ?? ''),
          confidenceAdjustment: Number(e.adversarial.confidenceAdjustment ?? 0),
        }
      : null,
    fetches: (e.fetches ?? []).map((f: any) => ({
      id: String(f.id ?? ''),
      url: String(f.url ?? ''),
      status: String(f.status ?? ''),
      excerpt: f.excerpt ? String(f.excerpt) : undefined,
    })),
    consensus: {
      state: String(e.consensus?.state ?? ''),
      majority: String(e.consensus?.majority ?? ''),
      counts: (e.consensus?.counts ?? {}) as Record<string, number>,
      agreementRatio: Number(e.consensus?.agreementRatio ?? 0),
      validCount: Number(e.consensus?.validCount ?? 0),
      finalVerdict: Number(e.consensus?.finalVerdict ?? 0),
      confidenceBp: Number(e.consensus?.confidenceBp ?? 0),
      reviewRequired: Boolean(e.consensus?.reviewRequired),
    },
    ok: Boolean(e.ok),
    error: e.error ? String(e.error) : null,
    evaluatedAt: Number(e.evaluatedAt ?? 0),
    version: Number(e.version ?? 0),
  };
}

export class AgentCourt {
  readonly config: AgentCourtConfig;
  private gl: GenLayerClient;
  private connected = false;
  private deployedChecked = false;

  constructor(config: AgentCourtConfig) {
    this.config = config;
    this.gl = new GenLayerClient(config.rpcUrl);
  }

  async connectWallet(ethereum: unknown): Promise<string> {
    const accounts = await (ethereum as any).request({ method: 'eth_requestAccounts' });
    const address = String(accounts[0]) as `0x${string}`;
    await this.gl.connectWallet(ethereum, address);
    this.connected = true;
    return address;
  }

  getSigner(): string | null {
    return this.connected ? this.gl.connectedAddress : null;
  }

  private requireConnected(): void {
    if (!this.connected || !this.gl.hasWriteClient) {
      throw new Error('Wallet not connected');
    }
  }

  private async readIc<T>(method: string, args: unknown[]): Promise<T> {
    const res = await this.gl.genCallRaw<T>(this.config.coreAddress, method, args);
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
    await this.readIc<number>('get_dispute_count', []);
    this.deployedChecked = true;
  }

  private async writeCore(
    method: string,
    args: unknown[],
    value = BigInt(0),
    wait?: { waitRetries?: number; waitIntervalMs?: number; wait?: boolean },
  ): Promise<string> {
    this.requireConnected();
    return this.gl.genWrite(this.config.coreAddress, method, args, { value, ...wait });
  }

  // ---------------------------------------------------------------------------
  // Reads — AgentCourtCore
  // ---------------------------------------------------------------------------

  async getDispute(disputeId: bigint): Promise<DisputeRecord> {
    await this.ensureDeployed();
    const d = await this.readIc<any>('get_dispute', [Number(disputeId)]);
    if (d === null || d === undefined) {
      throw new Error(`Dispute #${disputeId} does not exist on this chain.`);
    }
    return mapDispute(d);
  }

  async getEvidence(evidenceId: bigint): Promise<DisputeEvidence> {
    const e = await this.readIc<any>('get_evidence', [Number(evidenceId)]);
    if (!e) throw new Error(`Evidence #${evidenceId} not found.`);
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

  async getEvaluation(disputeId: bigint): Promise<EvaluationRecord | null> {
    await this.ensureDeployed();
    const e = await this.readIc<any>('get_evaluation', [Number(disputeId)]);
    return mapEvaluation(e);
  }

  async getDisputeEvidenceIds(disputeId: bigint): Promise<bigint[]> {
    await this.ensureDeployed();
    const ids = await this.readIc<any[]>('get_dispute_evidence_ids', [Number(disputeId)]);
    return (ids ?? []).map((id) => asBig(id));
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
        try {
          return await this.getEvidence(id);
        } catch {
          return {
            id,
            disputeId,
            evidenceType: 'CUSTOM',
            source: '',
            refUri: '',
            contentHash: '',
            timestamp: 0n,
            submitter: '',
            description: '',
            verified: false,
          };
        }
      }),
    );

    const [verdict, consensus, evaluation] = await Promise.all([
      this.getVerdict(disputeId),
      this.getConsensusRecords(disputeId),
      this.getEvaluation(disputeId),
    ]);

    return { dispute, evidence, verdict, consensus, evaluation };
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
    const results = await Promise.allSettled(ids.map((id) => this.getDispute(id)));
    return results
      .filter((r): r is PromiseFulfilledResult<DisputeRecord> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  // ---------------------------------------------------------------------------
  // Writes — genlayer-js writeContract (no caller-supplied verdicts)
  // ---------------------------------------------------------------------------

  async createDispute(params: {
    respondent: string;
    agreementHash: string;
    claimType: string;
    description: string;
    stake: bigint;
    deadline: bigint;
  }): Promise<bigint> {
    const before = await this.getDisputeCount();
    // Stake is metadata only — do not attach value (avoids locking GEN / non-payable failures).
    await this.writeCore(
      'create_dispute',
      [
        params.respondent,
        params.agreementHash,
        CLAIM_TYPE_MAP[params.claimType] ?? 0,
        params.description,
        Number(params.stake),
        Number(params.deadline),
      ],
      BigInt(0),
    );
    const after = await this.pollDisputeCount(before + BigInt(1));
    if (after !== before + BigInt(1)) {
      throw new ContractExecutionError(
        'create_dispute',
        `Dispute count did not increase (before=${before}, after=${after}).`,
      );
    }
    return after;
  }

  /** Poll until `get_dispute_count` reaches `target` (accepted-state read lag). */
  private async pollDisputeCount(target: bigint, timeoutMs = 15_000): Promise<bigint> {
    const deadline = Date.now() + timeoutMs;
    let last = await this.getDisputeCount();
    while (Date.now() < deadline) {
      if (last >= target) return last;
      await new Promise((r) => setTimeout(r, 400));
      last = await this.getDisputeCount();
    }
    return last;
  }

  async submitEvidence(
    params: {
      disputeId: bigint;
      evidenceType: string;
      source: string;
      refUri: string;
      contentHash: string;
      description: string;
    },
    opts: { wait?: boolean } = {},
  ): Promise<bigint | null> {
    const wait = opts.wait !== false;
    await this.writeCore(
      'submit_evidence',
      [
        Number(params.disputeId),
        EVIDENCE_TYPE_MAP[params.evidenceType] ?? 0,
        params.source,
        params.refUri,
        params.contentHash,
        params.description,
      ],
      BigInt(0),
      { wait },
    );
    if (!wait) {
      return null;
    }
    return (await this.pollLastEvidenceId(params.disputeId)) ?? null;
  }

  private async pollLastEvidenceId(
    disputeId: bigint,
    timeoutMs = 15_000,
  ): Promise<bigint | undefined> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ids = await this.getDisputeEvidenceIds(disputeId);
      const last = ids[ids.length - 1];
      if (last !== undefined) return last;
      await new Promise((r) => setTimeout(r, 400));
    }
    return undefined;
  }

  /**
   * Submit several evidence items as back-to-back txs (no per-tx consensus wait),
   * then poll until all are visible on the accepted state.
   */
  async submitEvidenceBatch(
    items: Array<{
      disputeId: bigint;
      evidenceType: string;
      source: string;
      refUri: string;
      contentHash: string;
      description: string;
    }>,
  ): Promise<bigint[]> {
    if (items.length === 0) return [];
    const disputeId = items[0]!.disputeId;
    const before = await this.getDisputeEvidenceIds(disputeId);

    for (const item of items) {
      await this.writeCore(
        'submit_evidence',
        [
          Number(item.disputeId),
          EVIDENCE_TYPE_MAP[item.evidenceType] ?? 0,
          item.source,
          item.refUri,
          item.contentHash,
          item.description,
        ],
        BigInt(0),
        { wait: false },
      );
    }

    const target = before.length + items.length;
    const deadline = Date.now() + 20_000;
    let ids = before;
    while (Date.now() < deadline) {
      ids = await this.getDisputeEvidenceIds(disputeId);
      if (ids.length >= target) return ids.slice(before.length);
      await new Promise((r) => setTimeout(r, 500));
    }
    if (ids.length < target) {
      throw new Error(
        `Evidence batch incomplete: expected ${target} items, found ${ids.length} on-chain.`,
      );
    }
    return ids.slice(before.length);
  }

  async startInvestigation(disputeId: bigint): Promise<void> {
    await this.writeCore('start_investigation', [Number(disputeId)]);
  }

  /** Kick off nondeterministic evaluation + validator consensus. No verdict args. */
  async requestEvaluation(disputeId: bigint): Promise<void> {
    // LLM + adversarial + validator consensus regularly exceeds 30s / even 3 min.
    // Budget ≈ 10 minutes (600 × 1s) before surfacing TransactionPendingError.
    await this.writeCore('request_evaluation', [Number(disputeId)], BigInt(0), {
      waitRetries: 600,
      waitIntervalMs: 1_000,
    });
  }

  /**
   * Finalize from the stored evaluation only.
   * Intentionally has NO verdict/confidence/resolution parameters.
   */
  async finalizeVerdict(disputeId: bigint): Promise<void> {
    await this.writeCore('finalize_verdict', [Number(disputeId)]);
  }

  async openAppeal(disputeId: bigint, reason: string): Promise<void> {
    await this.writeCore('open_appeal', [Number(disputeId), reason]);
  }

  async executeSettlement(disputeId: bigint): Promise<void> {
    await this.writeCore('execute_settlement', [Number(disputeId)]);
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
}
