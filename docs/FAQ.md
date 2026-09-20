# Frequently Asked Questions

## General

### What is AgentCourt?
AgentCourt is a decentralized dispute resolution protocol built on GenLayer. It investigates machine-readable disputes using verifiable evidence, independent AI reasoning, adversarial review, and consensus before triggering deterministic on-chain settlement.

### How does AgentCourt differ from a simple AI judge?
AgentCourt uses multiple independent evaluators, adversarial review, and structured evidence verification. A simple AI judge uses a single LLM call with no review or consensus.

### What dispute types are supported?
- Delivery failures
- Payment failures
- Performance issues
- Data quality problems
- Marketplace violations
- Agent contract breaches

## Technical

### What chain does AgentCourt run on?
AgentCourt runs on GenLayer Studionet (Chain ID: 61999) during development.

### How are verdicts produced?
1. Evidence is collected and verified
2. Multiple evaluators independently analyze the dispute
3. An adversarial reviewer challenges the initial conclusion
4. Consensus aggregates independent evaluations
5. A final verdict with confidence score is produced

### What happens when evidence is insufficient?
AgentCourt defaults to REVIEW state rather than automatically settling. This preserves funds and allows human intervention.

### How does cross-contract communication work?
- **Reads**: Synchronous via `gl.get_contract_at().view()`
- **Writes**: Asynchronous via `gl.get_contract_at().emit()`

## Integration

### How do I integrate AgentCourt into my application?
1. Deploy the three core contracts (DisputeRegistry, ResolutionManager, AgentCourtCore)
2. Use the TypeScript SDK for frontend integration
3. Define your agreement schema and settlement rules

### Can AgentCourt integrate with existing escrow systems?
Yes. AgentCourt produces a verdict; the escrow contract interprets it according to predefined settlement rules.

### What is the recommended first dispute type?
SERVICE_DELIVERY. It provides clear, understandable evidence patterns for initial integration.

## Security

### How does AgentCourt prevent prompt injection?
External web content is treated as data, not instructions. Evaluators are isolated from untrusted content.

### What happens if evaluators collude?
Mitigations include independent evaluator selection, source diversity, adversarial review, and economic penalties.

### How are malicious participants penalized?
Dispute participants post bonds. Malicious behavior can result in bond slashing.
