# Architecture Decisions

## ADR-001: Consolidate 6 Contracts to 3

### Status
Accepted

### Context
Initially had 6 separate contracts:
- DisputeRegistry
- EvidenceRegistry
- VerdictRegistry
- AppealManager
- SettlementAdapter
- AgentCourtCore

### Decision
Consolidate into 3 contracts:
- DisputeRegistry (disputes + evidence + verdicts)
- ResolutionManager (appeals + settlement)
- AgentCourtCore (orchestrator)

### Rationale
- Reduce cross-contract call complexity
- Simplify deployment process
- Lower gas costs
- Easier to maintain

### Consequences
- Larger contract size
- Less modular separation
- Simpler architecture

## ADR-002: Use emit() for Cross-Contract Writes

### Status
Accepted

### Context
GenLayer ICs require async writes via emit().

### Decision
Use emit() for all cross-contract write operations.

### Rationale
- GenLayer architecture requirement
- Asynchronous execution model
- Prevents reentrancy issues

### Consequences
- No return values from writes
- Need local state tracking
- Eventual consistency

## ADR-003: Local State in AgentCourtCore

### Status
Accepted

### Context
emit() is async, can't get return values.

### Decision
AgentCourtCore maintains local dispute/evidence IDs.

### Rationale
- Enable immediate ID return
- Reduce cross-contract reads
- Primary source of truth

### Consequences
- State duplication
- Need synchronization
- Consistency challenges
