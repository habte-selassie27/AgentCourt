# AgentCourt Architecture

## System Overview

AgentCourt is a decentralized dispute resolution protocol built on GenLayer.

## Contract Architecture

```
AgentCourtCore (orchestrator)
    ├── DisputeRegistry (disputes + evidence + verdicts)
    └── ResolutionManager (appeals + settlement)
```

## Dispute Lifecycle

```
Claim → Evidence → Investigation → Deliberation → Adversarial Review → Consensus → Verdict → Settlement
```

## Cross-Contract Communication

- **Reads**: Synchronous via `gl.get_contract_at().view()`
- **Writes**: Asynchronous via `gl.get_contract_at().emit()`

## Evidence Model

Evidence is stored on-chain with:
- Type classification (transaction, web, API, signed message)
- Source tracking for independence verification
- Content hashing for integrity
- Verification status

## Consensus Mechanism

1. Independent evaluators analyze evidence
2. Adversarial reviewer challenges conclusions
3. Protocol-defined consensus aggregates results
4. Verdict produced with confidence score
