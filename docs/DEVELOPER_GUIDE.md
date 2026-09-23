# AgentCourt Developer Guide

> Consolidated from: `SDK_REFERENCE.md`, `API_REFERENCE.md`, `CONTRACT_INTERACTION.md`, `INTEGRATION.md`, `EXAMPLES.md`, `ERROR_HANDLING.md`

## Contents

1. [SDK Reference](#sdk-reference)
2. [Contract API Reference](#contract-api-reference)
3. [Contract Interaction Guide](#contract-interaction-guide)
4. [Integration Guide](#integration-guide)
5. [Examples](#examples)
6. [Error Handling](#error-handling)

> Architecture: two Intelligent Contracts — **AgentCourtCore** (orchestrator: disputes, evidence, evaluation, verdicts) and **ResolutionManager** (appeals + settlement). See [PROTOCOL.md](PROTOCOL.md) for the design and [OPERATIONS.md](OPERATIONS.md) for deployment.

---

# SDK Reference

The TypeScript SDK lives in-repo at `frontend/src/sdk` (there is no published npm package).

## Setup

```typescript
import { getCourt } from './sdk';

// getCourt() is a singleton configured from environment variables:
//   VITE_RPC_URL              (default: https://studio.genlayer.com/api)
//   VITE_AGENTCOURT_CORE      AgentCourtCore address
//   VITE_RESOLUTION_MANAGER   ResolutionManager address
//   VITE_CHAIN_ID             (default: 61999)
const court = getCourt();

// Or construct explicitly:
import { AgentCourt } from './sdk';
const court = new AgentCourt({
  rpcUrl: 'https://studio.genlayer.com/api',
  coreAddress: '0x...',
  resolutionManagerAddress: '0x...',
  chainId: 61999,
});

// Writes require a connected browser wallet:
const address = await court.connectWallet((window as any).ethereum);
```

## Read Methods

| Method | Returns |
|---|---|
| `getDispute(disputeId: bigint)` | `DisputeRecord` (throws if the dispute does not exist) |
| `getEvidence(evidenceId: bigint)` | `DisputeEvidence` |
| `getDisputeEvidenceIds(disputeId: bigint)` | `bigint[]` |
| `hasVerdict(disputeId: bigint)` | `boolean` |
| `getVerdict(disputeId: bigint)` | `VerdictRecord \| null` |
| `getEvaluation(disputeId: bigint)` | `EvaluationRecord \| null` |
| `getConsensusRecords(disputeId: bigint)` | `ConsensusRecord[]` |
| `getConsensusCount(disputeId: bigint)` | `bigint` |
| `loadDisputeDetail(disputeId: bigint)` | `DisputeDetailData` (dispute + evidence + verdict + consensus + evaluation) |
| `getDisputeCount()` | `bigint` |
| `listDisputes()` | `DisputeRecord[]` |

## Write Methods (wallet required)

| Method | Returns |
|---|---|
| `createDispute(params)` | `bigint` — new dispute id |
| `submitEvidence(params)` | `bigint` — new evidence id |
| `startInvestigation(disputeId: bigint)` | `void` |
| `requestEvaluation(disputeId: bigint)` | `void` — runs the evaluation pipeline (may take minutes) |
| `finalizeVerdict(disputeId: bigint)` | `void` — derives the verdict from the stored evaluation |
| `openAppeal(disputeId: bigint, reason: string)` | `void` |
| `executeSettlement(disputeId: bigint)` | `void` |

## Polling

```typescript
const verdict = await court.waitForVerdict(
  disputeId,
  300_000,   // timeoutMs (default 5 min)
  5_000,     // pollIntervalMs
);
```

## Core Types

```typescript
interface DisputeRecord {
  id: bigint;
  claimant: string;
  respondent: string;
  agreementHash: string;
  claimType: string;      // e.g. 'DELIVERY_FAILURE'
  stake: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: string;         // e.g. 'EVIDENCE_COLLECTION'
  description: string;
}

interface VerdictRecord {
  disputeId: bigint;
  verdict: string;         // TRUE | FALSE | MISLEADING | UNVERIFIABLE | REVIEW
  confidence: bigint;      // basis points — divide by CONFIDENCE_DENOMINATOR (10000)
  reasoningHash: string;
  evidenceIds: bigint[];
  resolution: string;      // RELEASE_TO_CLAIMANT | RELEASE_TO_RESPONDENT | SPLIT | FREEZE | SLASH | REVIEW
  reviewRequired: boolean;
  finalizedAt: bigint;
}

interface DisputeEvidence {
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

interface DisputeDetailData {
  dispute: DisputeRecord;
  evidence: DisputeEvidence[];
  verdict: VerdictRecord | null;
  consensus: ConsensusRecord[];
  evaluation: EvaluationRecord | null;
}
```

`EvaluationRecord` includes the per-role `evaluators`, the `adversarial` pass result (`challenges[]`, `verdictUpheld`, `confidenceAdjustment`), the raw web `fetches`, and the `consensus` summary (`state`, `majority`, `agreementRatio`, `validCount`, `finalVerdict`, `confidenceBp`, `reviewRequired`).

## String Enums

Statuses (in lifecycle order):
`NONE, OPEN, EVIDENCE_COLLECTION, INVESTIGATION, DELIBERATION, ADVERSARIAL_REVIEW, CONSENSUS, VERDICT, SETTLEMENT, CLOSED, APPEALED, EVALUATION_PENDING, EVALUATION_FAILED, INCONCLUSIVE, DISPUTED`

Verdicts: `TRUE, FALSE, MISLEADING, UNVERIFIABLE, REVIEW`

Claim types: `DELIVERY_FAILURE, PAYMENT_FAILURE, PERFORMANCE_FAILURE, DATA_QUALITY, MARKETPLACE_VIOLATION, AGENT_CONTRACT_BREACH, ORACLE_MALFUNCTION, ESCROW_DISPUTE, CUSTOM`

Evidence types: `ONCHAIN_TRANSACTION, WEB_PAGE, API_RESPONSE, SIGNED_MESSAGE, CONTENT_HASH, CUSTOM`

Unknown string values map to `0` on write (`DELIVERY_FAILURE` / `ONCHAIN_TRANSACTION`).

## Lifecycle

```text
createDispute → submitEvidence → startInvestigation → requestEvaluation
      → finalizeVerdict → executeSettlement
                                  ↘ openAppeal (after verdict; triggers re-evaluation)
```

---

# Contract API Reference

## AgentCourtCore — `intelligent-contracts/core/agentcourt_core.py`

### Write Methods

```python
create_dispute(respondent, agreement_hash, claim_type, description, stake, deadline) -> uint256
submit_evidence(dispute_id, evidence_type, source, ref_uri, content_hash, description) -> uint256
start_investigation(dispute_id)
request_evaluation(dispute_id) -> str        # consensus state; no verdict arguments accepted
finalize_verdict(dispute_id) -> uint256      # verdict derived on-chain from the stored evaluation
execute_settlement(dispute_id)               # requires finalized, non-frozen verdict
open_appeal(dispute_id, reason)              # requires a finalized verdict
pause() / unpause()                          # owner only
```

### Read Methods

```python
get_dispute(dispute_id) -> dict | None
get_dispute_count() -> int
get_evidence(evidence_id) -> dict | None
get_dispute_evidence_ids(dispute_id) -> list
is_evidence_verified(evidence_id) -> bool
get_evaluation(dispute_id) -> dict | None
get_consensus_records(dispute_id) -> list
get_consensus_count(dispute_id) -> int
has_verdict(dispute_id) -> bool
get_verdict(dispute_id) -> dict | None
is_paused() -> bool
get_owner() -> str
```

## ResolutionManager — `intelligent-contracts/registry/resolution_manager.py`

### Admin (owner only)

```python
set_core(core_address)        # one-time wiring; settlement/appeals refuse to run until set
set_appeal_bond(new_bond)
set_appeal_window(new_window)
set_max_rounds(new_max)
pause() / unpause()
```

### Write Methods

```python
open_appeal(dispute_id, appellant, reason)   # called by AgentCourtCore
resolve_appeal(appeal_id)                    # owner only
execute_settlement(dispute_id)               # AgentCourtCore only; idempotent
```

### Read Methods

```python
get_appeal(appeal_id) -> dict | None
get_dispute_appeals(dispute_id) -> list
get_appeal_count(dispute_id) -> int
is_settled(dispute_id) -> bool
get_settlement_nonce(dispute_id) -> int
get_settlement(dispute_id) -> dict | None    # nonce + verdict/resolution snapshot
get_owner() -> str
```

---

# Contract Interaction Guide

## From the Frontend

Use the SDK — it wraps `genlayer-js` reads and writes against AgentCourtCore (see [SDK Reference](#sdk-reference)):

```typescript
const disputeId = await court.createDispute({
  respondent: '0x...',
  agreementHash: keccak256(toUtf8Bytes('agreement')),
  claimType: 'DELIVERY_FAILURE',
  description: 'Service not delivered',
  stake: parseEther('0.001'),
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
});
```

## Between Intelligent Contracts

**Reads** are synchronous via `.view()`:

```python
# ResolutionManager reading the verdict back from core during settlement
core = gl.get_contract_at(self.core)
verdict = core.view().get_verdict(int(dispute_id))
```

**Writes** are asynchronous via `.emit()`:

```python
# AgentCourtCore → ResolutionManager
manager = gl.get_contract_at(self.resolution_manager)
manager.emit(on="finalized").execute_settlement(int(dispute_id))
manager.emit(on="finalized").open_appeal(int(dispute_id), str(gl.message.sender_address), str(reason))
```

`emit()` returns no value — AgentCourtCore keeps local state as the source of truth (see ADR-002/003 in [PROTOCOL.md](PROTOCOL.md)).

## Tracking Progress

There is no event-subscription API in the SDK; poll instead:

```typescript
// Watch a dispute move through its lifecycle
const detail = await court.loadDisputeDetail(disputeId);
console.log(detail.dispute.status, detail.evaluation?.consensus.state);

// Or block until a verdict exists
const verdict = await court.waitForVerdict(disputeId);
```

---

# Integration Guide

## For Escrow / Settlement Consumers

Consume finalized verdicts from AgentCourtCore, or settlement records from ResolutionManager:

```python
# Inside another GenLayer IC
RESOLUTION_RELEASE_TO_CLAIMANT = 0
RESOLUTION_RELEASE_TO_RESPONDENT = 1

core = gl.get_contract_at(CORE_ADDRESS)
verdict = core.view().get_verdict(int(dispute_id))

if verdict is not None and not bool(verdict.get("reviewRequired")):
    resolution = int(verdict.get("resolution"))
    if resolution == RESOLUTION_RELEASE_TO_CLAIMANT:
        ...  # release to claimant
    elif resolution == RESOLUTION_RELEASE_TO_RESPONDENT:
        ...  # release to respondent
else:
    ...  # frozen: REVIEW / UNVERIFIABLE / adversarial override
```

Resolution mapping (derived on-chain, see [PROTOCOL.md](PROTOCOL.md)):
`TRUE → RELEASE_TO_CLAIMANT`, `FALSE → RELEASE_TO_RESPONDENT`, `MISLEADING → REVIEW`, `UNVERIFIABLE → FREEZE`, `REVIEW → FREEZE`.

## For Marketplaces

```typescript
// Auto-create a dispute on buyer complaint
async function handleComplaint(seller: string, orderId: string, orderValue: bigint, deadline: bigint) {
  return court.createDispute({
    respondent: seller,
    agreementHash: hashOrder(orderId),
    claimType: 'DELIVERY_FAILURE',
    description: `Order ${orderId} not delivered`,
    stake: orderValue,
    deadline,
  });
}
```

## For Autonomous Agents

```typescript
// Agent-to-agent dispute resolution
async function resolveAgentDispute(agentBAddress: string, agreement: {
  hash: string; stake: bigint; deadline: bigint;
}) {
  const disputeId = await court.createDispute({
    respondent: agentBAddress,
    agreementHash: agreement.hash,
    claimType: 'AGENT_CONTRACT_BREACH',
    description: 'Agent B violated service agreement',
    stake: agreement.stake,
    deadline: agreement.deadline,
  });

  return court.waitForVerdict(disputeId);
}
```

---

# Examples

## Full Dispute Lifecycle

```typescript
import { getCourt, CONFIDENCE_DENOMINATOR } from './sdk';

const court = getCourt();
await court.connectWallet((window as any).ethereum);

// 1. Create
const disputeId = await court.createDispute({
  respondent: '0x1234...5678',
  agreementHash: keccak256(toUtf8Bytes('dataset delivery')),
  claimType: 'DELIVERY_FAILURE',
  description: 'Agent B failed to deliver the dataset',
  stake: parseEther('0.001'),
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
});

// 2. Evidence
const evidenceId = await court.submitEvidence({
  disputeId,
  evidenceType: 'ONCHAIN_TRANSACTION',
  source: 'chain',
  refUri: '0xabc...def',
  contentHash: keccak256(toUtf8Bytes('payment proof')),
  description: 'Payment transaction confirming delivery',
});

// 3. Investigate + evaluate (evaluation may take minutes)
await court.startInvestigation(disputeId);
await court.requestEvaluation(disputeId);

// 4. Finalize — verdict is derived on-chain, no verdict argument
await court.finalizeVerdict(disputeId);

const verdict = await court.getVerdict(disputeId);
if (verdict) {
  console.log(`Verdict: ${verdict.verdict}`);
  console.log(`Confidence: ${Number(verdict.confidence) / CONFIDENCE_DENOMINATOR}`); // e.g. 0.87
  console.log(`Resolution: ${verdict.resolution}`);
}

// 5. Settle (refuses when reviewRequired)
await court.executeSettlement(disputeId);
```

## Inspecting an Evaluation

```typescript
const evaluation = await court.getEvaluation(disputeId);
if (evaluation) {
  for (const e of evaluation.evaluators) {
    console.log(`${e.role}: ${e.verdict} (${e.confidence})`);
  }
  console.log('Adversarial upheld:', evaluation.adversarial?.verdictUpheld);
  console.log('Consensus:', evaluation.consensus.state, evaluation.consensus.agreementRatio);
  console.log('Web fetches:', evaluation.fetches);
}
```

## Waiting for a Verdict

```typescript
const verdict = await court.waitForVerdict(disputeId, 300_000, 5_000);
```

---

# Error Handling

## Contract Errors

Contract reverts raise `gl.vm.UserError` on-chain and surface in the SDK as `ContractExecutionError`. Common messages:

| Message | Meaning |
|---|---|
| `Not a dispute party` | Caller is neither claimant, respondent, nor owner |
| `Contract is paused` | Owner paused the contract |
| `Evaluation not allowed from this status` | Lifecycle guard on `request_evaluation` |
| `No evaluation ready to finalize` | `finalize_verdict` called before a successful evaluation |
| `Evaluation failed; cannot finalize` | Last evaluation ended in `EVALUATION_FAILED` |
| `Verdict required before settlement` | Settlement attempted before finalization |
| `Review required; settlement frozen` | Verdict has `reviewRequired` set |
| `Verdict superseded` | An appeal produced a newer verdict |
| `Dispute already settled` | Idempotency guard in ResolutionManager |
| `Only core may execute settlement` | ResolutionManager is callable by AgentCourtCore only |
| `Appeal requires a finalized verdict` | Appeal lifecycle guard |

**Recovering from evaluation failure:** a dispute in `EVALUATION_FAILED`, `INCONCLUSIVE`, or `DISPUTED` can be re-evaluated — call `requestEvaluation` again. This is the intended retry path for transient LLM/source failures.

## Frontend / SDK Errors

Use `describeError` to turn raw errors into user-friendly messages:

```typescript
import { describeError } from './sdk';

try {
  await court.requestEvaluation(disputeId);
} catch (err) {
  const friendly = describeError(err);
  console.log(friendly.title);     // short headline
  console.log(friendly.hint);      // actionable guidance
  console.log(friendly.retryable); // whether retrying makes sense
}
```

Typical cases handled by the SDK:

- **Wallet not connected** — writes throw `'Wallet not connected'` until `connectWallet` succeeds.
- **Contract execution failed** — the contracts reverted on-chain (`ContractExecutionError` with the execution detail).
- **Cannot reach the network** — RPC endpoint unreachable; check `VITE_RPC_URL`.
- **Not found on-chain** — dispute/evidence does not exist on this chain (not retryable).

## Retry Strategy

For transient errors:
1. Wait with exponential backoff
2. Retry up to 3 times
3. Log failure details
4. Escalate if persistent

On-chain evaluation failures are persistent state, not exceptions — recover them via re-evaluation (above), not by retrying the same transaction.
