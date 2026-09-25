# AgentCourt Architecture

## System Overview

AgentCourt is a decentralized dispute resolution protocol built exclusively on GenLayer Intelligent Contracts (Python ICs). There is no Solidity contract path.

## Contract Architecture

```
AgentCourtCore (Python IC)
  ├── disputes, evidence, evaluations, verdicts (local TreeMap state)
  ├── request_evaluation → gl.vm.run_nondet
  │     ├── gl.nondet.web.get (http evidence)
  │     ├── gl.nondet.exec_prompt × 4 independent roles
  │     └── gl.nondet.exec_prompt (adversarial review)
  │           validators re-derive consensus exactly + independent neutral re-check
  ├── finalize_verdict(dispute_id)   # NO verdict parameter
  └── execute_settlement(dispute_id) → emits to ResolutionManager

ResolutionManager (Python IC)
  ├── set_core (one-time wiring)
  ├── open_appeal / resolve_appeal (reads core verdict versions)
  └── execute_settlement(dispute_id)  # reads core.get_verdict() via view()
```

## Dispute Lifecycle

```
Claim → Evidence → Investigation → Nondeterministic Evaluation
  → Validator consensus on substantive outcome
  → CONSENSUS | INCONCLUSIVE | DISPUTED | EVALUATION_FAILED
  → Verdict (derived) → Settlement → Closed
```

## Cross-Contract Communication

- **Reads**: Synchronous via `gl.get_contract_at().view()`
- **Writes**: Asynchronous via `gl.get_contract_at().emit()`

## Caller Isolation Invariant

`CALLER INPUT ≠ FINAL VERDICT`

| Operation | Caller supplies | Derived by protocol |
|---|---|---|
| create_dispute | claim metadata | id, status |
| submit_evidence | evidence fields | ids, linkage |
| request_evaluation | dispute id | evaluation via nondet + validators |
| finalize_verdict | dispute id | verdict, confidence, resolution |
| execute_settlement | dispute id | action from stored verdict |
| resolve_appeal | appeal id | compares core verdict versions |

## Fail-Closed States

- `EVALUATION_FAILED` (status 12) — nondet path failed; not finalizable
- `INCONCLUSIVE` (status 13) — insufficient agreement → UNVERIFIABLE / FREEZE
- `DISPUTED` (status 14) — material evaluator split → REVIEW / FREEZE
- `reviewRequired` on any verdict blocks `execute_settlement`

## Evidence Model

Evidence is stored on-chain in AgentCourtCore with type classification, source tracking, content hashing, and submitter address. Web URLs are fetched inside the nondeterministic block; page content is treated as untrusted DATA (prompt-injection hardening).

## Consensus Mechanism

1. Four independent LLM roles evaluate the same evidence package
2. Adversarial reviewer challenges the emerging majority
3. Deterministic majority tally + agreement threshold (0.6) classifies the state
4. GenLayer validators (sandboxed via `run_nondet`) re-derive the consensus block exactly (`consensus_consistent`) and corroborate decisive TRUE/FALSE verdicts with an independent neutral re-evaluation
5. `finalize_verdict` commits the derived verdict — never a caller argument
