# AgentCourt Operations Guide

> Consolidated from: `DEPLOYMENT.md`, `CONTRACT_ADDRESSES.md`, `TESTING.md`, `MONITORING.md`, `PERFORMANCE.md`, `SCALABILITY.md`, `FAILOVER.md`, `TROUBLESHOOTING.md`

## Contents

1. [Deployment Guide](#deployment-guide)
2. [Deployed Contract Addresses](#deployed-contract-addresses)
3. [Testing Guide](#testing-guide)
4. [Monitoring Guide](#monitoring-guide)
5. [Performance Considerations](#performance-considerations)
6. [Scalability Analysis](#scalability-analysis)
7. [Failover Strategies](#failover-strategies)
8. [Troubleshooting](#troubleshooting)

---

# Deployment Guide

## Prerequisites

- GenLayer Studio account (`genlayer account list`)
- GEN tokens for gas
- `genlayer` CLI and `genvm-lint` on PATH
- Node.js 20+ for frontend

## Deploying Intelligent Contracts

There is no Solidity/Foundry path. Only Python Intelligent Contracts.

### Step 1: Lint

```bash
GENVM_VERSION=v0.3.0-rc7 genvm-lint check intelligent-contracts/registry/resolution_manager.py
GENVM_VERSION=v0.3.0-rc7 genvm-lint check intelligent-contracts/core/agentcourt_core.py
```

> `GENVM_VERSION=v0.3.0-rc7` is required until genvm-linter can extract the
> `.zip` / legacy runner layout in newer GenVM releases (v0.6.0-rc3).

### Step 2: Deploy ResolutionManager

```bash
genlayer deploy --contract intelligent-contracts/registry/resolution_manager.py
```

Copy the contract address (e.g. `0x...`).

### Step 3: Deploy AgentCourtCore

```bash
genlayer deploy \
  --contract intelligent-contracts/core/agentcourt_core.py \
  --args <RESOLUTION_MANAGER_ADDRESS>
```

### Step 4: Wire core into the manager

```bash
genlayer write \
  --contract <RESOLUTION_MANAGER_ADDRESS> \
  --method set_core \
  --args <AGENTCOURT_CORE_ADDRESS>
```

`set_core` is one-time only (owner). Settlement and appeals refuse to run until core is set.

### Step 5: Environment

```bash
cp .env.example .env
# VITE_AGENTCOURT_CORE=...
# VITE_RESOLUTION_MANAGER=...
```

## Workflow on chain

1. `create_dispute` / `submit_evidence` — caller claim data only
2. `start_investigation`
3. `request_evaluation` — nondeterministic LLM + validator consensus (may take minutes)
4. `finalize_verdict(dispute_id)` — **no verdict argument**
5. `execute_settlement(dispute_id)` — manager reads core verdict

## Deploying Frontend

### Vercel Deployment

```bash
npm run build
vercel --prod
```

### Environment Variables

- `VITE_AGENTCOURT_CORE`
- `VITE_RESOLUTION_MANAGER`
- `VITE_RPC_URL`
- `VITE_CHAIN_ID`

---

# Deployed Contract Addresses

## GenLayer Studionet (Chain ID: 61999) — current

| Contract | Address | Tx / notes |
|---|---|---|
| ResolutionManager | `0xb3f14B5565a4342dc0c111AA8C3674de42B0E530` | manually deployed via Studio; `set_core` **pending** (owner must call) |
| AgentCourtCore | `0xEC3d5e5375823F936d6Adb2F4541aa8966672578` | manually deployed via Studio; owner `0x5B36…4c89` |

Active CLI account: `rabby` `0x04e0353b7218b66d6803725ce7342e6e1225db1b` (not owner — cannot call `set_core`).

### Orphan / failed deploys (do not use)

| Address | What it is |
|---|---|
| `0xBa2e6a6Eb90B543E8F6e65cfeeB606c59577677B` | Prior current core; superseded by redeploy |
| `0xEe3406BBF390afcfE6423a6f19815Ee0AE9125Ea` | Prior current manager; superseded by redeploy |
| `0xA95331FD97E9D43CF0A3869E36F6C3E40C1b9F31` | Core deploy failed (`Address(Address)` TypeError) — not on chain |
| `0x1201907228F04Fe454B9E4e878aB1077D591d45c` | Core pointed at pre-fix manager; superseded |
| `0xE8Eae0b3CB3d0d2e92db037960914309758FA1c5` | Manager without `set_core` Address fix; superseded |
| `0xE3e71ad910c656d3BceD3EcEb3AAA27A0d2b711D` | Accidental parallel manager deploy; superseded |
| `0xaf829B532e1FD8d328910E5D076Df753A87f81E0` | Accidental parallel manager deploy; superseded |
| `0x1201eF62b96133c652c668e200C096D16BcaD0CF` | Legacy pre-remediation core (never deployed) |
| `0xa8c7C20Edd5db93067203939Ad6a85eDb52B5F55` | Legacy pre-remediation manager |
| `0x57802A80B38c68a7EbE814F4249a8Ac6768319b4` | Legacy DisputeRegistry (removed from codebase) |
| `0x88D6013FC7aC2c0Af802F4DaC6F7e3d5983e5685` | Prior CLI core; superseded by manual Studio deploy |
| `0xA0F4D59ba22651bb11e48C4d827ED160c2b30525` | Prior CLI manager; superseded by manual Studio deploy |
| `0xb02d083109B1A0214BF700fB1a5acF7eaF7c0d1A` | Orphan parallel core (set_core already taken) |
| `0x7C696ab6bf4AD478e22a588F1209E543a50D4a47` | Older CLI core; superseded |
| `0x94ea120e2E0Ad2eD909A62f79e722BfAFeE7329d` | Older CLI manager; superseded |

### Removed supporting contracts (deterministic helpers — deleted)

EvidenceVerifier, DisputeJudge, AdversarialReviewer, ConsensusEngine —
evaluation now lives inside `AgentCourtCore.request_evaluation`.

## Redeploy

```bash
genlayer deploy --contract intelligent-contracts/registry/resolution_manager.py
genlayer deploy --contract intelligent-contracts/core/agentcourt_core.py --args <resolution_manager_address>
genlayer write <resolution_manager_address> set_core --args <core_address>
```

Then set `VITE_AGENTCOURT_CORE` and `VITE_RESOLUTION_MANAGER` in `.env` and rebuild.

---

# Testing Guide

## Unit / Acceptance Tests (Python)

The Intelligent Contracts are tested through a GenLayer stub (`tests/genlayer_stub.py`) that runs the full IC workflow in-memory:

```bash
# Run all Python tests (IC workflow + caller isolation)
pytest tests/unit/ -v

# Run a specific test file
pytest tests/unit/test_genlayer_workflow.py -v
```

Coverage includes the dispute lifecycle, evaluation classification (pure helpers), caller-isolation guards, and fail-closed paths.

## SDK / Frontend Tests (TypeScript)

```bash
# Run all tests (vitest)
npm test

# Run a specific test file
npm test -- tests/sdk.agentcourt.test.ts

# Watch mode
npm test -- --watch
```

## Linting Intelligent Contracts

```bash
genvm-lint check intelligent-contracts/core/agentcourt_core.py
genvm-lint check intelligent-contracts/registry/resolution_manager.py
```

## Adversarial Coverage

Test scenarios to maintain:
- Prompt injection attempts via evidence URLs
- Fake evidence submissions
- Caller-supplied verdict rejection (finalize takes no verdict argument)
- Unauthorized settlement / appeal attempts
- Evaluator disagreement paths (DISPUTED, INCONCLUSIVE)

## CI/CD

CI (`.github/workflows/ci.yml`) runs on pull requests and main-branch pushes: `genvm-lint`, `pytest tests/unit/`, and the frontend build + tests.

---

# Monitoring Guide

## Key Metrics

### Dispute Metrics
- Total disputes created
- Disputes by type
- Average resolution time
- Settlement success rate
- Appeal rate

### Evidence Metrics
- Evidence submissions per dispute
- Source diversity score
- Verification success rate
- External source availability

### Performance Metrics
- Average investigation time
- Average deliberation time
- Consensus achievement rate
- Adversarial review impact

## Health Checks

### Contract Status
```typescript
import { getCourt } from './sdk';

async function checkHealth() {
  const court = getCourt();
  const disputeCount = await court.getDisputeCount();

  // `is_paused()` and `get_owner()` exist on-chain but are not SDK-wrapped;
  // call them directly against the core address if you need them.

  return {
    disputes: disputeCount.toString(),
    status: 'healthy',
  };
}
```

### Explorer Links
- AgentCourtCore: `0xEC3d5e5375823F936d6Adb2F4541aa8966672578`
- ResolutionManager: `0xb3f14B5565a4342dc0c111AA8C3674de42B0E530`
- DisputeRegistry: removed from codebase (legacy: `0x57802A80B38c68a7EbE814F4249a8Ac6768319b4`)

## Alerting

### Critical Alerts
- Contract paused unexpectedly
- Settlement failures
- Dispute stuck in state > 1 hour
- Evidence verification failures

### Warning Alerts
- High dispute rate
- Low consensus rate
- Source availability < 90%
- Appeal rate increasing

## Logging

### Structured Logs
```json
{
  "event": "DISPUTE_CREATED",
  "dispute_id": 42,
  "claimant": "0x...",
  "claim_type": "DELIVERY_FAILURE",
  "timestamp": "2026-09-20T10:30:00Z"
}
```

### Event Trail
Every dispute produces:
1. DISPUTE_CREATED
2. EVIDENCE_SUBMITTED
3. INVESTIGATION_STARTED
4. EVIDENCE_VERIFIED
5. DELIBERATION_STARTED
6. ADVERSARIAL_REVIEW_STARTED
7. CONSENSUS_REACHED
8. VERDICT_FINALIZED
9. SETTLEMENT_EXECUTED

---

# Performance Considerations

## Gas Optimization

### Storage Patterns
- Use TreeMap for dynamic data
- Avoid frequent storage updates
- Batch operations when possible

### Cross-Contract Calls
- Minimize cross-contract reads
- Use local caching in AgentCourtCore
- Batch emit() calls

## Latency

### Direct Tests
- ~30ms per test
- No server required
- In-memory execution

### Integration Tests
- Seconds to minutes
- Full consensus validation
- Real network conditions

### Production
- Evidence submission: ~5s
- Evaluation (`request_evaluation`): minutes — LLM evaluators plus validator consensus
- Finalization: ~5s (reads stored evaluation, no LLM call)
- Settlement: ~10s

## Scalability

### Current Limits
- 32 pending transactions per sender
- Per-contract caps apply
- Rate limits: 60 req/min

### Future Improvements
- Parallel evidence verification
- Sharded dispute processing
- Layer 2 integration

---

# Scalability Analysis

## Current Capacity

### GenLayer Studionet Limits
- 32 pending transactions per sender
- Per-contract caps apply
- Rate limits: 60 req/min, 1000 req/hr

### AgentCourt Throughput
- Evidence submission: ~5s per transaction
- Evaluation (`request_evaluation`): minutes per dispute (LLM evaluators + validator consensus)
- Finalization: ~5s per dispute (derived from stored evaluation)
- Settlement: ~10s per dispute

## Bottlenecks

### Cross-Contract Calls
Each dispute requires a small number of cross-contract calls:
1. Create dispute + submit evidence → AgentCourtCore
2. Start investigation → AgentCourtCore
3. Request evaluation → AgentCourtCore (nondet LLM + validators)
4. Finalize verdict → AgentCourtCore (derived from evaluation)
5. Settle → ResolutionManager (reads core verdict)

### Sequential Execution
- emit() calls are asynchronous
- Can't parallelize within single dispute
- Can process multiple disputes in parallel

## Optimization Strategies

### Batching
```python
# Batch evidence submissions
def submit_evidence_batch(self, dispute_id, evidence_list):
    for evidence in evidence_list:
        self.submit_evidence(dispute_id, evidence)
```

### Caching
```python
# Cache dispute data in AgentCourtCore
self.disputes[str(dispute_id)] = json.dumps(dispute)
# Avoid repeated cross-contract reads
```

### Lazy Verification
```python
# Verify evidence only when needed
def is_evidence_verified(self, evidence_id) -> bool:
    return self.evidence.get(str(evidence_id)) is not None
```

## Horizontal Scaling

### Multiple Deployments
```
AgentCourtCore instance A (marketplace A)
AgentCourtCore instance B (marketplace B)
    └── each wired to its own ResolutionManager
```

### Sharding
- Partition disputes by type
- Assign to different registries
- Aggregate verdicts across shards

## Future Improvements

### Layer 2 Integration
- Process disputes off-chain
- Batch settlement on-chain
- Reduce gas costs

### Parallel Processing
- Independent evidence verification
- Concurrent evaluator analysis
- Async adversarial review

### Caching Layer
- Cache frequently accessed data
- Reduce cross-contract reads
- Improve response times

---

# Failover Strategies

## Source Failure

### External Source Unavailable
```
Source Timeout
    ↓
Retry (2 attempts)
    ↓
Alternative Source
    ↓
REVIEW if all fail
```

### Conflicting Sources
```
Source A: TRUE
Source B: FALSE
    ↓
Source Comparison
    ↓
Independent Verification
    ↓
Consensus Resolution
```

## Evaluator Failure

### Single Evaluator Timeout
```
Evaluator A: Timeout
Evaluator B: TRUE
Evaluator C: TRUE
Evaluator D: TRUE
    ↓
Majority Consensus
    ↓
Proceed with reduced confidence
```

### All Evaluators Disagree
```
Evaluator A: TRUE
Evaluator B: FALSE
Evaluator C: TRUE
Evaluator D: FALSE
    ↓
Adversarial Review
    ↓
Additional Evaluation
    ↓
REVIEW if unresolved
```

## Settlement Failure

### Transaction Reverted
```
Settlement Attempt
    ↓
Transaction Failed
    ↓
Retry with higher gas
    ↓
Manual Review if persistent
```

### Idempotency Protection
```
Settlement Nonce Check
    ↓
Already Settled → Skip
    ↓
Not Settled → Execute
```

## Emergency Procedures

### Pause Mechanism
Both contracts expose owner-only pause. Pattern (from `AgentCourtCore`):

```python
@gl.public.write
def pause(self):
    if gl.message.sender_address != self.owner:
        raise gl.vm.UserError("Not owner")
    self.paused = True

def _require_not_paused(self):
    if self.paused:
        raise gl.vm.UserError("Contract is paused")
```

ResolutionManager additionally refuses settlement/appeals until `set_core` wiring is done.

### Emergency Settlement
For critical incidents:
1. Pause new disputes
2. Finalize pending verdicts
3. Execute settlements
4. Investigate post-mortem

---

# Troubleshooting

## Common Issues

### Contract Deployment Fails

**Symptom**: `AssertionError: Is right the same storage type?`

**Solution**: Do **not** assign `TreeMap()` in `__init__`. Annotated `TreeMap[K, V]`
fields are zero-initialized by GenVM as `{}`. Assigning an in-memory `TreeMap()`
causes `AssertionError: Is right the same storage type?` on deploy.

### Wrong Sender Address

**Symptom**: `'MessageType' object has no attribute 'sender_account'`

**Solution**: Use `gl.message.sender_address` instead of `gl.message.sender_account`.

### Schema Loading Error

**Symptom**: `Could not load contract schema`

**Solution**: Check for typos in type annotations (e.g., `u257` should be `u256`).

### Frontend Can't Load Disputes

**Symptom**: `No contract deployed at 0x...`

**Solution**: Update `.env` with correct contract addresses from GenLayer Studio.

### Cross-Contract Call Fails

**Symptom**: `gl.exec.cross_call` not found

**Solution**: Use `gl.get_contract_at(address).view()` for reads, `.emit()` for writes.

## Debug Mode

Enable verbose logging:
```bash
DEBUG=agentcourt:* npm run dev
```

## Support

- GitHub Issues: https://github.com/habte-selassie27/AgentCourt/issues
- GenLayer Docs: https://docs.genlayer.com
