# AgentCourt

> **Autonomous dispute resolution for the agent economy — powered by GenLayer Intelligent Contracts.**
>
> *When agents disagree, let the evidence speak.*

AgentCourt is a decentralized arbitration protocol that turns a machine-readable dispute into an executable investigation:

```text
Claim → Evidence → Investigation → Independent Reasoning → Adversarial Review → Consensus → Verdict → Settlement
```

Instead of a single LLM answer or a centralized moderator, four independent evaluator roles reason over the same evidence, an adversarial reviewer challenges the emerging majority, GenLayer validators re-derive the consensus exactly and independently re-check decisive verdicts, and the final verdict is derived on-chain — never supplied by a caller.

---

## The problem

Autonomous agents and protocols transact with each other constantly — datasets delivered, APIs purchased, escrows funded, SLAs promised. When they disagree, today's options are human support queues, private arbitrators, or a single opaque AI call. None of that scales to machine-to-machine commerce, and none of it is auditable.

AgentCourt provides **recourse** as a programmable, transparent primitive:

- Evidence is explicit and referenced by ID.
- Reasoning is independent, multi-role, and adversarially reviewed.
- Uncertainty is represented (`UNVERIFIABLE`, `REVIEW`) instead of forced into a binary.
- Settlement is deterministic and reads only the on-chain verdict — fail-closed when review is required.

## What it does (the problem it solves)

| Pain today | AgentCourt answer |
|---|---|
| "The AI said so" with no process | Full evidence → evaluators → adversarial → consensus trail on-chain |
| One LLM call is trivially gamed | 4 roles + adversarial + sandboxed validator check (`run_nondet`) |
| Caller can submit a favorable verdict | **Caller input ≠ final verdict** — `finalize_verdict(dispute_id)` takes no verdict |
| Uncertain cases auto-settle unsafely | Fail-closed states: `EVALUATION_FAILED` / `INCONCLUSIVE` / `DISPUTED` freeze settlement |
| Escrow can't consume AI opinions | Machine-readable verdict: `{verdict, confidence, resolution, reviewRequired}` |

## Deployed contracts (GenLayer Studionet, Chain ID 61999)

| Contract | Address |
|---|---|
| **AgentCourtCore** | [`0xeFc4318024F63ca06CC138B354D6539c9841A3B4`](https://explorer-studio.genlayer.com/address/0xeFc4318024F63ca06CC138B354D6539c9841A3B4) |
| **ResolutionManager** | [`0x4c63c9C105AD80A905456c986A027BDA46F9687a`](https://explorer-studio.genlayer.com/address/0x4c63c9C105AD80A905456c986A027BDA46F9687a) |

`set_core` **must be wired once** by the manager owner (owner of this deployment: `0x5B36…4c89`). There is **no Solidity path** — both contracts are Python GenLayer Intelligent Contracts.

## How to use it

### 1. Install

```bash
git clone https://github.com/habte-selassie27/AgentCourt.git
cd AgentCourt
npm install
cp .env.example .env   # set VITE_AGENTCOURT_CORE / VITE_RESOLUTION_MANAGER if you redeploy
```

### 2. Run the frontend

```bash
npm run dev
```

Connect a wallet on chain **61999** (the UI offers to switch/add the network), then walk the full lifecycle from the dashboard:

1. **Create dispute** (parties, agreement hash, claim type, stake, deadline + evidence)
2. **Start investigation**
3. **Request evaluation** — live web fetch of evidence URLs + 4 LLM evaluators + adversarial review under validator consensus (takes minutes)
4. **Finalize verdict** — no inputs; derived from the stored evaluation
5. **Execute settlement** — only when `reviewRequired` is false; optionally **Open appeal**

### 3. Run the checks

```bash
pytest tests/unit/ -v                 # 39 Python acceptance tests (IC workflow + caller isolation)
npm test                              # vitest domain tests
npm run typecheck && npm run build    # TypeScript + Vite build
GENVM_VERSION=v0.3.0-rc7 genvm-lint check intelligent-contracts/core/agentcourt_core.py
GENVM_VERSION=v0.3.0-rc7 genvm-lint check intelligent-contracts/registry/resolution_manager.py
```

### 4. Integrate from TypeScript

```typescript
import { getCourt } from './sdk';

const court = getCourt();
const address = await court.connectWallet((window as any).ethereum);

const disputeId = await court.createDispute({ /* respondent, agreementHash, claimType, description, stake, deadline, evidence[] */ });
await court.startInvestigation(disputeId);
await court.requestEvaluation(disputeId);            // minutes: LLM + validators
const verdict = await court.waitForVerdict(disputeId);
if (!verdict.reviewRequired) await court.executeSettlement(disputeId);
```

Full method tables, contract API, and error handling: [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).

## Architecture

```text
AgentCourtCore (Python IC)
  ├── disputes, evidence, evaluations, verdicts (TreeMap state)
  ├── request_evaluation → gl.vm.run_nondet
  │      ├── gl.nondet.web.get       (live HTTP evidence fetch)
  │      ├── gl.nondet.exec_prompt × 4 (neutral / claimant / respondent / auditor)
  │      └── gl.nondet.exec_prompt     (adversarial review)
  │            validators re-derive the consensus exactly
  │            and independently re-check decisive verdicts
  ├── finalize_verdict(dispute_id)     # NO verdict parameter
  └── execute_settlement(dispute_id)   # emits to ResolutionManager

ResolutionManager (Python IC)
  ├── set_core (one-time wiring)
  ├── open_appeal / resolve_appeal (compares core verdict versions)
  └── execute_settlement(dispute_id)   # reads core.get_verdict() via view()
```

**Caller isolation invariant:** `CALLER INPUT ≠ FINAL VERDICT` — `finalize_verdict`, `execute_settlement`, and `resolve_appeal` accept only an ID; verdict, confidence, resolution, and appeal outcomes are all derived from stored protocol state.

**Fail-closed:** `reviewRequired` verdicts and the `EVALUATION_FAILED` / `INCONCLUSIVE` / `DISPUTED` states refuse settlement (freeze), never auto-release.

Details: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`docs/PROTOCOL.md`](docs/PROTOCOL.md)

## Repository layout

```text
agentcourt/
├── intelligent-contracts/
│   ├── core/agentcourt_core.py        # disputes, evidence, nondet evaluation, verdicts
│   └── registry/resolution_manager.py # settlement + appeals (reads core verdict)
├── frontend/src/
│   ├── sdk/                           # genlayer-js client + typed AgentCourt SDK
│   ├── components/                    # dashboard, detail, forms, explorers
│   └── dispute|evidence|verdict|settlement/
├── tests/
│   ├── unit/test_genlayer_workflow.py # 39 acceptance tests
│   ├── genlayer_stub.py               # CPython stub of the genlayer module
│   └── sdk.agentcourt.test.ts         # vitest domain tests
├── docs/                              # PROTOCOL, DEVELOPER_GUIDE, OPERATIONS, …
├── scripts/deploy/                    # deploy + wire helper
├── scripts/verification/              # on-chain smoke checks
├── ARCHITECTURE.md
├── AUDIT.md                           # Portal rejection remediation notes
├── SECURITY.md
└── AGENTS.md                          # full protocol spec
```

## Documentation

| Doc | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Two-IC design, lifecycle, caller isolation, fail-closed states |
| [`docs/PROTOCOL.md`](docs/PROTOCOL.md) | Evidence model, consensus rules, verdict classes, ADRs |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | SDK methods, contract API, integration examples |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Deployment, addresses, monitoring, troubleshooting |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Use cases, FAQ, roadmap |
| [`AUDIT.md`](AUDIT.md) | Why the first submission was rejected and exactly what changed |
| [`SECURITY.md`](SECURITY.md) · [`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md) | Threat model, prompt-injection posture, privacy |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, style, PR process |
| [`AGENTS.md`](AGENTS.md) | Complete protocol specification |

## Quality & verification

- **Live data:** evidence URLs are fetched inside the nondeterministic block via `gl.nondet.web.get`; all reads/writes go to GenLayer Studionet through `genlayer-js`.
- **Tests:** 39 Python acceptance tests (caller isolation, fail-closed paths, consensus classification, timestamps, Keccak commitments) + 5 vitest tests.
- **CI:** `genvm-lint check` on both ICs, `pytest`, frontend build (`.github/workflows/ci.yml`).
- **Audit trail:** [`AUDIT.md`](AUDIT.md) documents the verbatim GenLayer Portal rejection, every defect, and the remediation.

## Status & disclaimer

AgentCourt is an experimental protocol. Contracts are deployed on **GenLayer Studionet (test infrastructure)** — do not treat them as production arbitration. Stake/bond amounts are recorded as metadata; on-chain fund custody is future work (see `AUDIT.md`).

This software is not legal advice and is not a substitute for jurisdiction-specific arbitration procedures.

## License

MIT — see [`LICENSE`](LICENSE).
