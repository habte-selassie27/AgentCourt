import { describe, it, expect } from 'vitest';
import { JsonRpcProvider, parseEther, ZeroHash } from 'ethers';
import { AgentCourt, CONFIDENCE_DENOMINATOR } from '../frontend/src/sdk/agentcourt';

/** Anvil account 0: funded, and unlocked by the node. */
const FUNDED_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const COUNTERPARTY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

/**
 * These tests exercise the real SDK read path against a live chain. They need
 * AgentCourtCore deployed; by default they target a local anvil instance using
 * the deterministic addresses produced by `forge script contracts/script/Deploy.s.sol`.
 *
 *   anvil
 *   PRIVATE_KEY=<anvil key 0> forge script contracts/script/Deploy.s.sol \
 *     --rpc-url http://127.0.0.1:8545 --broadcast
 *
 * When no deployment is found the suite skips rather than fails, so it stays
 * safe to run in environments without a chain.
 */
const RPC_URL = process.env.AGENTCOURT_TEST_RPC ?? 'http://127.0.0.1:8545';
const CORE_ADDRESS =
  process.env.AGENTCOURT_TEST_CORE ?? '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
const DISPUTE_ID = BigInt(process.env.AGENTCOURT_TEST_DISPUTE ?? '1');

const STATUSES = [
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
];
const VERDICTS = ['NONE', 'TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE', 'REVIEW'];

async function deploymentIsLive(): Promise<boolean> {
  try {
    const code = await new JsonRpcProvider(RPC_URL).getCode(CORE_ADDRESS);
    return Boolean(code) && code !== '0x';
  } catch {
    return false;
  }
}

const live = await deploymentIsLive();

/**
 * Connects the SDK the way a browser wallet would. The shim answers account
 * lookups locally and forwards everything else to the node, which signs for its
 * own unlocked account.
 */
async function connectFundedAccount(court: AgentCourt): Promise<void> {
  const provider = new JsonRpcProvider(RPC_URL);
  const ethereum = {
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return [FUNDED_ACCOUNT];
      }
      return provider.send(method, params ?? []);
    },
  };

  const address = await court.connectWallet(ethereum);
  expect(address).toBe(FUNDED_ACCOUNT);
}

function makeCourt(): AgentCourt {
  return new AgentCourt({
    rpcUrl: RPC_URL,
    coreAddress: CORE_ADDRESS,
    disputeRegistryAddress: process.env.AGENTCOURT_TEST_DISPUTE_REGISTRY ?? '',
    evidenceRegistryAddress: process.env.AGENTCOURT_TEST_EVIDENCE_REGISTRY ?? '',
    verdictRegistryAddress: process.env.AGENTCOURT_TEST_VERDICT_REGISTRY ?? '',
    appealManagerAddress: '',
    settlementAdapterAddress: process.env.AGENTCOURT_TEST_SETTLEMENT ?? '',
  });
}

describe.skipIf(!live)('AgentCourt SDK against a live deployment', () => {
  it('decodes dispute state from the core contract', async () => {
    const court = makeCourt();
    const dispute = await court.getDispute(DISPUTE_ID);

    expect(dispute.id).toBe(DISPUTE_ID);
    expect(STATUSES).toContain(dispute.status);
    expect(dispute.claimant).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(dispute.respondent).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(dispute.createdAt).toBeGreaterThan(0n);
    expect(dispute.deadline).toBeGreaterThan(0n);
  });

  it('reports a missing dispute instead of fabricating zero values', async () => {
    const court = makeCourt();
    await expect(court.getDispute(999_999n)).rejects.toThrow(/does not exist/);
  });

  it('decodes the evidence tuple and verification flags', async () => {
    const court = makeCourt();
    const evidenceIds = await court.getDisputeEvidenceIds(DISPUTE_ID);
    const detail = await court.loadDisputeDetail(DISPUTE_ID);

    expect(detail.evidence).toHaveLength(evidenceIds.length);

    for (const item of detail.evidence) {
      expect(item.disputeId).toBe(DISPUTE_ID);
      expect(typeof item.evidenceType).toBe('string');
      expect(typeof item.verified).toBe('boolean');
    }
  });

  it('decodes consensus records consistently with the count', async () => {
    const court = makeCourt();
    const [count, records] = await Promise.all([
      court.getConsensusCount(DISPUTE_ID),
      court.getConsensusRecords(DISPUTE_ID),
    ]);

    expect(records).toHaveLength(Number(count));

    for (const record of records) {
      expect(VERDICTS).toContain(record.verdict);
      expect(record.evaluator).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(record.confidence).toBeLessThanOrEqual(BigInt(CONFIDENCE_DENOMINATOR));
    }
  });

  it('decodes the verdict tuple and agrees with hasVerdict', async () => {
    const court = makeCourt();
    const [hasVerdict, verdict] = await Promise.all([
      court.hasVerdict(DISPUTE_ID),
      court.getVerdict(DISPUTE_ID),
    ]);

    expect(verdict !== null).toBe(hasVerdict);

    if (verdict) {
      expect(VERDICTS).toContain(verdict.verdict);
      expect(verdict.disputeId).toBe(DISPUTE_ID);
      expect(verdict.confidence).toBeLessThanOrEqual(BigInt(CONFIDENCE_DENOMINATOR));
      expect(typeof verdict.reviewRequired).toBe('boolean');
      expect(verdict.finalizedAt).toBeGreaterThan(0n);
    }
  });

  it('lists every dispute on chain with sequential ids', async () => {
    const court = makeCourt();
    const [count, disputes] = await Promise.all([
      court.getDisputeCount(),
      court.listDisputes(),
    ]);

    expect(disputes).toHaveLength(Number(count));
    disputes.forEach((dispute, index) => {
      expect(dispute.id).toBe(BigInt(index + 1));
    });

    // Each summary must match an independent read of that dispute.
    const first = await court.getDispute(disputes[0].id);
    expect(first.status).toBe(disputes[0].status);
    expect(first.claimant).toBe(disputes[0].claimant);
    expect(first.description).toBe(disputes[0].description);
  });

  it('creates a dispute and attaches evidence in one flow', async () => {
    const court = makeCourt();
    await connectFundedAccount(court);

    const countBefore = await court.getDisputeCount();
    const disputeId = await court.createDispute({
      respondent: COUNTERPARTY,
      agreementHash: `0x${'11'.repeat(32)}`,
      claimType: 'DELIVERY_FAILURE',
      description: 'e2e: dataset delivered below the agreed completeness',
      stake: parseEther('0.001'),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86_400),
    });

    expect(disputeId).toBe(countBefore + 1n);

    const refUri = `0x${'22'.repeat(32)}`;
    const evidenceId = await court.submitEvidence({
      disputeId,
      evidenceType: 'ONCHAIN_TRANSACTION',
      source: 'anvil',
      refUri,
      contentHash: ZeroHash,
      description: 'payment transaction',
    });

    // A dispute created through the form must never end up with no evidence.
    const detail = await court.loadDisputeDetail(disputeId);
    expect(detail.dispute.status).toBe('EVIDENCE_COLLECTION');
    expect(detail.evidence).toHaveLength(1);
    expect(detail.evidence[0].id).toBe(evidenceId);
    expect(detail.evidence[0].refUri).toBe(refUri);
    expect(detail.evidence[0].source).toBe('anvil');
    expect(detail.evidence[0].verified).toBe(false);
  });

  it('loads the whole detail payload in one call', async () => {
    const court = makeCourt();
    const detail = await court.loadDisputeDetail(DISPUTE_ID);

    expect(detail.dispute.id).toBe(DISPUTE_ID);
    expect(Array.isArray(detail.evidence)).toBe(true);
    expect(Array.isArray(detail.consensus)).toBe(true);
    expect(detail.verdict === null || VERDICTS.includes(detail.verdict.verdict)).toBe(true);
  });
});

describe.skipIf(live)('AgentCourt SDK without a deployment', () => {
  it('surfaces a clear error rather than phantom data', async () => {
    const court = makeCourt();
    await expect(court.getDispute(1n)).rejects.toThrow(/No contract deployed at/);
  });
});
