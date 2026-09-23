# AgentCourt Audit — GenLayer Portal Rejection Remediation

## Root Cause

The previous submission mixed a Solidity `AgentCourtCore` (EVM, not GenLayer IC) with Python Intelligent Contracts that either:

1. **Accepted caller-supplied verdicts** and treated them as final, or
2. **Never ran a nondeterministic evaluation** that validators could check.

### Rejection (verbatim)

> "We cannot accept this submission because the contracts deterministically process caller-supplied assertions and do not perform the claimed GenLayer AI evaluation or validator consensus. Please add a genuine nondeterministic evidence-evaluation path with validators checking the substantive verdict, then connect the application to that implemented workflow."

### Concrete defects (pre-fix)

| Location | Defect |
|---|---|
| `contracts/src/VerdictRegistry.sol` `submitConsensus(disputeId, verdict, …)` | Caller writes verdict + confidence with no auth |
| `contracts/src/VerdictRegistry.sol` `finalizeVerdict(disputeId, verdict, …)` | Caller finalizes arbitrary verdict |
| `contracts/src/AgentCourtCore.sol` `finalizeVerdict(…, uint8 verdict, …)` | Same — Solidity path, not GenLayer IC |
| `contracts/src/SettlementAdapter.sol` / `ResolutionManager` `execute_settlement(id, verdict, action)` | Trusts caller args for money movement |
| `ResolutionManager.resolve_appeal(…, supersedingVerdict)` | Owner/caller supplies superseding verdict |
| Registry write methods | Unguarded public writes → forgeable state |
| Entire repo | Zero uses of `gl.vm.run_nondet*`, `gl.nondet.exec_prompt`, or web fetch |
| `intelligent-contracts/disputes/dispute_judge.py` | Deterministic keyword matching, `@gl.public.view`, not on verdict path |
| `intelligent-contracts/consensus/consensus_engine.py` | Aggregates caller-supplied evaluator results |
| Frontend write path | ethers `sendTransaction` + Solidity ABI against Python IC addresses |

**Invariant violated:** `CALLER INPUT ≠ FINAL VERDICT`.

## Files Changed

### Removed (Solidity / fake deterministic path)

- `contracts/` (entire tree), `foundry.toml`, `broadcast/`, `cache/`, `lib/forge-std`
- `intelligent-contracts/disputes/`, `evidence/`, `adversarial/`, `consensus/`
- `intelligent-contracts/registry/dispute_registry.py` (state folded into core)
- Stale Python/TS tests for deleted modules; forge scripts in `package.json`

### Rewritten

- `intelligent-contracts/core/agentcourt_core.py` — full IC with nondet evaluation
- `intelligent-contracts/registry/resolution_manager.py` — settlement/appeal authority from core only
- `frontend/src/sdk/agentcourt.ts` — genlayer-js reads+writes, no caller verdict API
- `frontend/src/sdk/genlayer.ts` — writeContract + wallet support
- `frontend/src/sdk/index.ts`, `types.ts`, `dispute/index.ts` — new statuses, no registry/judge addresses
- `frontend/src/components/DisputeDetail.tsx` — evaluation workflow UI
- `tests/**` — genlayer stub + 8 acceptance tests
- `.github/workflows/ci.yml`, `.env.example`, `ARCHITECTURE.md`, `docs/OPERATIONS.md` (deployment + contract addresses)

## GenLayer Workflow

```
create_dispute / submit_evidence     (caller: claim + evidence only)
        ↓
start_investigation
        ↓
request_evaluation
  ├─ gl.nondet.web.render (http evidence)
  ├─ gl.nondet.exec_prompt × 4 independent roles
  ├─ gl.nondet.exec_prompt (adversarial review)
  └─ gl.vm.run_nondet_unsafe(leader, validator)
        validators re-run the pipeline and compare
        substantive outcome (state + finalVerdict + majority)
        ↓
status ∈ {CONSENSUS | INCONCLUSIVE | DISPUTED | EVALUATION_FAILED}
        ↓
finalize_verdict(dispute_id)     // NO verdict parameters
  derives verdict + resolution from stored evaluation
        ↓
execute_settlement(dispute_id)   // NO verdict/action parameters
  ResolutionManager reads core.get_verdict() via view()
```

## Consensus

- **In-protocol (GenLayer validators):** `run_nondet_unsafe` — leader executes the full evaluation; each validator independently re-executes and accepts only if `substantive_match` agrees on the **final outcome**, not free-text LLM strings.
- **In-evaluation (4 LLM roles):** neutral, claimant_advocate, respondent_advocate, auditor → majority tally + agreement ratio.
- **Adversarial review:** challenges lower confidence / force `reviewRequired` when `verdict_upheld` is false.
- **Thresholds:** `MIN_VALID_EVALUATORS=2`, `AGREEMENT_CONSENSUS_THRESHOLD=0.6`.

## Caller Isolation

| Call | Caller supplies | System derives |
|---|---|---|
| `create_dispute` | parties, claim metadata, stake, deadline | id, status |
| `submit_evidence` | evidence fields | id, linkage |
| `request_evaluation` | dispute id only | full evaluation via nondet |
| `finalize_verdict` | dispute id only | verdict, confidence, resolution, reviewRequired |
| `execute_settlement` | dispute id only | manager reads core verdict |
| `resolve_appeal` | appeal id only | compares core verdict versions |

Fail-closed: `EVALUATION_FAILED` / `INCONCLUSIVE` / `DISPUTED` never auto-settle; `reviewRequired` freezes settlement.

## Frontend Integration

- All writes: `genlayer-js` `writeContract` + `waitForTransactionReceipt`.
- All reads: `readContract` against **core** (registry deleted).
- New methods: `requestEvaluation`; `finalizeVerdict(disputeId)` **without** verdict args.
- UI states: Evaluation Pending/Failed/Inconclusive/Disputed, Consensus Reached, Finalize (no inputs), Execute Settlement only when `!reviewRequired`.

## Tests

`tests/unit/test_genlayer_workflow.py` covers the eight required checks plus timestamp/digest coverage:

1. No caller verdict on finalize/settlement signatures  
2. Caller cannot force verdict (pre-eval finalize raises; stranger blocked; manager core-only)  
3. Evaluation path exists (`run_nondet_unsafe`, `exec_prompt`, `web.render` in source)  
4. Evidence appears in evaluation prompts; different tallies → different outcomes  
5. Validator disagreement → `DISPUTED` / `INCONCLUSIVE`  
6. Consensus majority → `CONSENSUS` + TRUE/FALSE mapping  
7. Evaluation failure → `EVALUATION_FAILED`, not finalizable  
8. Only evaluation+consensus finalizes; settlement reads core verdict  
9. Real unix timestamps from `gl.message_raw['datetime']`; Keccak-256 `reasoningHash`

## Checks

| Check | Result |
|---|---|
| `genvm-lint lint` (both ICs) | ✓ 3 checks each |
| `genvm-lint check` (both ICs) | ✓ lint + validation (with `GENVM_VERSION=v0.3.0-rc7`) |
| `pytest tests/unit/ -q` | ✓ 39 passed |
| `npm run typecheck` | ✓ |
| `npm test` | ✓ 5 vitest tests |
| `npm run build` | ✓ vite build |
| Studionet `get_dispute_count` / `get_core` | ✓ live, `set_core` wired |

**genvm-lint environment note:** default GenVM resolution picks cached `v0.6.0-rc3`, whose runner bundle stores `py-genlayer` under `executor/.../legacy-runners/` and as `.zip` under `runners/`. genvm-linter 0.11.0 only extracts `runners/*.tar`, so validation fails with a missing-member KeyError. Pining `GENVM_VERSION=v0.3.0-rc7` (where the contract's Depends hash `1jb45aa8…` exists at `runners/py-genlayer/1j/….tar`) makes `check` pass cleanly. CI should set this env var until the linter adds zip/legacy support.

## Remaining Issues

1. **Studionet redeploy complete** — `ResolutionManager` `0x94ea120e2E0Ad2eD909A62f79e722BfAFeE7329d`, `AgentCourtCore` `0x7C696ab6bf4AD478e22a588F1209E543a50D4a47`, `set_core` verified via `get_core`. Verified live: `get_dispute_count` and `get_core` both respond on Studionet. Orphan/failed deploys listed in `docs/OPERATIONS.md`.
2. **No private keys in git history** — `.env` is gitignored and has never been committed (`git log --all -- .env` is empty). The local `.env` private key was redacted to a placeholder; rotate it anyway before any production use.
3. **Stake/bond economic enforcement** is metadata-level (recorded amounts); real fund custody needs a GenLayer value-transfer / escrow design beyond this remediation.
4. **LLM cost/latency** for `request_evaluation` is non-trivial (4+ prompts per run); cache or reduce roles for high-volume demos.
5. **Timestamps fixed** — `createdAt` / `timestamp` / `evaluatedAt` / `finalizedAt` / appeal `createdAt` now parse `gl.message_raw['datetime']` (ISO-8601 → unix seconds) with pure integer arithmetic (no `datetime` C-extension dependency inside GenVM). UI shows real times instead of `--`.
6. **genvm-lint check requires `GENVM_VERSION=v0.3.0-rc7`** until linter supports zip runners / legacy paths in v0.6.0-rc3.
7. **`reasoningHash` now uses Keccak-256** (`Keccak256` from the genlayer stdlib) instead of the previous toy polynomial hash.

## On-chain constructor gotchas (fixed this session):
   - `Address(Address)` raises `TypeError: cannot convert 'Address' object to bytes` when calldata already delivers an `Address` — constructors/`set_core` now isinstance-guard.
   - `gl.UserError` does not exist (AttributeError on-chain); correct path is `gl.vm.UserError` (lazy `gl` only exposes modules `vm`/`nondet`/…).
   - Annotated `TreeMap[K, V]` fields are zero-initialized by GenVM; do not assign `TreeMap()` in `__init__`.

