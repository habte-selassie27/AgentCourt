# AgentCourt Product Overview

> Consolidated from: `USE_CASES.md`, `FAQ.md`, `ROADMAP.md`

## Contents

1. [Use Cases](#use-cases)
2. [FAQ](#frequently-asked-questions)
3. [Roadmap](#roadmap)

---

# Use Cases

## 1. Autonomous Data Marketplace

### Scenario
Agent A purchases dataset from Agent B.

### Agreement
```json
{
  "service": "dataset_delivery",
  "format": "json",
  "minimumRecords": 10000,
  "minimumCompleteness": 0.95,
  "deadline": 1790000000
}
```

### Dispute
- **Claim**: Dataset incomplete
- **Evidence**: Download URL, validation report, record count
- **Verdict**: TRUE (seller failed completeness)
- **Resolution**: Refund buyer

## 2. Agent-to-Agent Service

### Scenario
ResearchAgent hires DataAgent for analysis.

### Agreement
```json
{
  "service": "data_analysis",
  "input": "dataset_001",
  "output_format": "pdf",
  "deadline": 1790000000
}
```

### Dispute
- **Claim**: Analysis not delivered
- **Evidence**: Transaction hash, service logs, delivery timestamp
- **Verdict**: FALSE (analysis was delivered)
- **Resolution**: Release payment to seller

## 3. Compute Marketplace

### Scenario
User purchases GPU hours from provider.

### Agreement
```json
{
  "service": "gpu_compute",
  "hours": 10,
  "gpu_type": "A100",
  "uptime_guarantee": 0.99
}
```

### Dispute
- **Claim**: Insufficient uptime
- **Evidence**: API logs, monitoring data, provider metrics
- **Verdict**: TRUE (uptime below threshold)
- **Resolution**: Partial refund

## 4. Oracle Dispute

### Scenario
Protocol disputes oracle price feed.

### Agreement
```json
{
  "service": "price_feed",
  "asset": "BTC/USD",
  "source": "chainlink",
  "staleness_threshold": 300
}
```

### Dispute
- **Claim**: Oracle reported stale price
- **Evidence**: Oracle timestamp, block number, price history
- **Verdict**: UNVERIFIABLE (insufficient evidence)
- **Resolution**: Freeze settlement

## 5. Escrow Service

### Scenario
Buyer uses escrow for marketplace purchase.

### Agreement
```json
{
  "service": "escrow",
  "buyer": "0xBUYER",
  "seller": "0xSELLER",
  "amount": "1000 USDC",
  "condition": "delivery_confirmed"
}
```

### Dispute
- **Claim**: Delivery not confirmed
- **Evidence**: Delivery receipt, tracking info, photos
- **Verdict**: TRUE (delivery confirmed)
- **Resolution**: Release funds to seller

---

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
- Oracle malfunctions
- Escrow disputes
- Custom (free-form structured claims)

## Technical

### What chain does AgentCourt run on?
AgentCourt runs on GenLayer Studionet (Chain ID: 61999) during development.

### How are verdicts produced?
1. Evidence is collected and checked (web references are fetched during evaluation)
2. Four role-based evaluators independently analyze the dispute
3. An adversarial pass challenges the evaluators' conclusion
4. Consensus is classified (CONSENSUS / INCONCLUSIVE / DISPUTED) and checked by validators (exact re-derivation + independent neutral re-check)
5. `finalize_verdict` derives the final verdict on-chain — callers cannot submit one

### What happens when evidence is insufficient?
AgentCourt defaults to REVIEW state rather than automatically settling. This preserves funds and allows human intervention.

### How does cross-contract communication work?
- **Reads**: Synchronous via `gl.get_contract_at().view()`
- **Writes**: Asynchronous via `gl.get_contract_at().emit()`

## Integration

### How do I integrate AgentCourt into my application?
1. Deploy the two Intelligent Contracts (ResolutionManager, AgentCourtCore) and wire them with `set_core`
2. Use the TypeScript SDK for frontend integration
3. Define your agreement schema and settlement rules

### Can AgentCourt integrate with existing escrow systems?
Yes. AgentCourt produces a verdict; the escrow contract interprets it according to predefined settlement rules.

### What is the recommended first dispute type?
DELIVERY_FAILURE. It provides clear, understandable evidence patterns for initial integration.

## Security

### How does AgentCourt prevent prompt injection?
External web content is treated as data, not instructions. Evaluators are isolated from untrusted content.

### What happens if evaluators collude?
Mitigations include independent evaluator selection, source diversity, adversarial review, and economic penalties.

### How are malicious participants penalized?
Dispute participants post bonds. Malicious behavior can result in bond slashing.

---

# Roadmap

## Phase 1 - Core Protocol ✅
- [x] AgentCourtCore IC (disputes + evidence + evaluation + verdicts)
- [x] ResolutionManager IC (settlement + appeals)
- [x] Nondeterministic evaluation path (`run_nondet` + `exec_prompt`)
- [x] Frontend dashboard with evaluation workflow
- [x] SDK integration (genlayer-js reads + writes)

## Phase 2 - Intelligence Layer ✅
- [x] 4 independent evaluator roles inside AgentCourtCore
- [x] Adversarial review under validator consensus
- [x] Fail-closed states (EVALUATION_FAILED / INCONCLUSIVE / DISPUTED)
- [x] Caller isolation (no caller-supplied verdicts)

## Phase 3 - Production Readiness
- [ ] Security audit
- [ ] Gas optimization
- [ ] Mainnet deployment
- [ ] Monitoring dashboard

## Phase 4 - Ecosystem
- [ ] Marketplace adapter
- [ ] Escrow adapter
- [ ] Oracle adapter
- [ ] Agent-to-agent protocol

## Phase 5 - Advanced Features
- [ ] ZK evidence verification
- [ ] Privacy-preserving disputes
- [ ] Cross-chain arbitration
- [ ] Reputation system
