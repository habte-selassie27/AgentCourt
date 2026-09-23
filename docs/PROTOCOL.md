# AgentCourt Protocol Specification

> Consolidated from: `DESIGN_PRINCIPLES.md`, `ARCHITECTURE_DECISIONS.md`, `DISPUTE_TYPES.md`, `EVIDENCE_MODEL.md`, `EVIDENCE_VERIFICATION.md`, `CONSENSUS.md`, `ADVERSARIAL_REVIEW.md`, `SETTLEMENT.md`, `COMPARISON.md`, `GLOSSARY.md`

## Contents

1. [Design Principles](#design-principles)
2. [Architecture Decisions](#architecture-decisions)
3. [Supported Dispute Types](#supported-dispute-types)
4. [Evidence Model](#evidence-model)
5. [Evidence Verification](#evidence-verification)
6. [Consensus Mechanism](#consensus-mechanism)
7. [Adversarial Review](#adversarial-review)
8. [Settlement Rules](#settlement-rules)
9. [AgentCourt vs Alternatives](#agentcourt-vs-alternatives)
10. [Glossary](#glossary)

---

# Design Principles

## 1. Evidence First

Evidence has priority over rhetoric. AgentCourt never makes a conclusion simply because an AI generated a persuasive explanation.

## 2. Fail-Closed

If the system cannot safely determine a verdict, it defaults to REVIEW rather than automatically settling disputed assets.

```
UNCERTAIN → REVIEW (not PAY)
```

## 3. Transparency

Every verdict exposes claim, evidence, reasoning summary, confidence, sources, consensus result, and resolution.

Users should never have to accept "the AI said so."

## 4. Source Diversity

A conclusion should not depend on one website, API, or data provider when multiple independent sources are available.

Five URLs do not necessarily mean five independent sources.

## 5. Deterministic Settlement

Financial settlement remains deterministic even when evidence interpretation is non-deterministic. The reasoning layer determines a verdict. The settlement layer executes predefined consequences.

## 6. Minimal Trust

Users should not need to trust a company moderator, one AI model, or one private arbitrator. The system exposes the process used to reach the outcome.

## 7. Uncertainty Representation

AgentCourt does not force a binary answer when evidence is insufficient. The protocol supports TRUE, FALSE, MISLEADING, UNVERIFIABLE, and REVIEW.

## 8. Modular Architecture

Each component (evidence verification, evaluation, adversarial review, consensus, settlement) is independent and can be upgraded separately.

## 9. Protocol Boundaries

AgentCourt focuses on disputes that can be expressed as structured claims and evaluated using observable evidence. Disputes where facts cannot be observed or legal interpretation dominates should enter REVIEW.

## 10. Separation of Concerns

- AI reasoning produces verdicts
- Deterministic contracts execute settlements
- Applications define settlement rules
- Governance controls protocol parameters

---

# Architecture Decisions

## ADR-001: Consolidate to Two Intelligent Contracts

### Status
Accepted

### Context
Earlier conceptual design had many modules (DisputeRegistry, EvidenceRegistry,
VerdictRegistry, AppealManager, SettlementAdapter, AgentCourtCore). A prior
submission also mixed a Solidity path that the GenLayer Portal rejected.

### Decision
Implement exclusively as two Python Intelligent Contracts:
- AgentCourtCore (disputes + evidence + evaluation + verdicts)
- ResolutionManager (settlement + appeals — reads core verdict only)

### Rationale
- Single source of truth for dispute state
- No Solidity / caller-verdict path
- Evaluation and finalization live in one nondeterministic workflow
- Settlement stays deterministic and reads the core verdict via `view()`

### Consequences
- Larger core contract
- Simpler deployment (2 contracts + `set_core` wiring)
- Evaluation state and dispute state share one contract

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
AgentCourtCore maintains local dispute/evidence IDs (no separate DisputeRegistry).

### Rationale
- Enable immediate ID return
- Reduce cross-contract reads
- Primary source of truth

### Consequences
- State lives entirely in core
- Manager only stores settlement/appeal records
- Need careful ownership wiring (`set_core`)

---

# Supported Dispute Types

## 1. Delivery Failure
- **Claim**: Service or product not delivered
- **Evidence**: Delivery receipts, timestamps, API responses
- **Settlement**: Refund or release based on verification

## 2. Payment Failure
- **Claim**: Payment not received or incorrect amount
- **Evidence**: Transaction hashes, blockchain records
- **Settlement**: Release escrow or slash bond

## 3. Performance Failure
- **Claim**: Service quality below agreement threshold
- **Evidence**: Metrics, benchmarks, SLA records
- **Settlement**: Partial refund or penalty

## 4. Data Quality
- **Claim**: Delivered data doesn't meet specifications
- **Evidence**: Data samples, validation reports
- **Settlement**: Replacement or refund

## 5. Marketplace Violation
- **Claim**: Seller violated marketplace rules
- **Evidence**: Listing data, transaction records
- **Settlement**: Account suspension, refund

## 6. Agent Contract Breach
- **Claim**: Autonomous agent violated agreement
- **Evidence**: Agent logs, API calls, outputs
- **Settlement**: Contract termination, penalties

## 7. Oracle Malfunction
- **Claim**: Oracle reported a stale or manipulated value
- **Evidence**: Oracle timestamps, block numbers, price history
- **Settlement**: Freeze or resolution per agreement

## 8. Escrow Dispute
- **Claim**: Escrow release conditions were (not) met
- **Evidence**: Delivery confirmations, escrow state, timestamps
- **Settlement**: Release, refund, or split

## 9. Custom
- **Claim**: Free-form structured claim (`CUSTOM` claim type)
- **Evidence**: Any supported evidence type
- **Settlement**: Derived from the finalized verdict

---

# Evidence Model

## Evidence Types

### On-Chain Transaction
- Blockchain transaction hash
- Block timestamp
- Sender/receiver addresses
- Value transferred

### Web Page
- URL reference
- Content hash
- Retrieval timestamp
- Page snapshot

### API Response
- Endpoint URL
- Response body hash
- Request timestamp
- Response headers

### Signed Message
- Signer address
- Message content
- Signature
- Timestamp

### Content Hash
- Raw content hash (`keccak256`)
- Description of the off-chain content

### Custom
- Free-form reference and description

## Evidence Verification

Evidence undergoes multiple verification stages:

1. **Existence**: Does the evidence exist?
2. **Relevance**: Is it related to the dispute?
3. **Integrity**: Has it been tampered with?
4. **Independence**: Are sources independent?
5. **Corroboration**: Do multiple sources agree?

## Source Independence

AgentCourt tracks source relationships to prevent:

- Multiple URLs pointing to same backend
- Circular references
- Single-source dependencies

---

# Evidence Verification

## Verification Stages

### 1. Existence Check
Does the evidence exist?
```python
def verify_existence(evidence):
    if evidence.type == "ONCHAIN_TRANSACTION":
        return check_transaction_exists(evidence.ref_uri)
    elif evidence.type == "WEB_PAGE":
        return fetch_url(evidence.ref_uri) is not None
    elif evidence.type == "API_RESPONSE":
        return call_api(evidence.ref_uri) is not None
    return False
```

### 2. Integrity Check
Has the evidence been tampered with?
```python
def verify_integrity(evidence):
    content = fetch_content(evidence.ref_uri)
    calculated_hash = hash_content(content)
    return calculated_hash == evidence.content_hash
```

### 3. Relevance Check
Is the evidence related to the dispute?
```python
def verify_relevance(evidence, claim):
    keywords = extract_keywords(claim)
    matches = count_keyword_matches(evidence, keywords)
    return matches >= THRESHOLD
```

### 4. Timestamp Check
Is the evidence from the relevant time period?
```python
def verify_timestamp(evidence, dispute):
    evidence_time = evidence.timestamp
    dispute_time = dispute.created_at
    deadline = dispute.deadline
    return dispute_time <= evidence_time <= deadline
```

### 5. Independence Check
Are sources independent?
```python
def verify_independence(evidences):
    sources = [e.source for e in evidences]
    dependencies = detect_dependencies(sources)
    return len(dependencies) == 0
```

## Verification Results

### Verified
All checks passed:
```python
VerificationResult(
    status="VERIFIED",
    checks=["existence", "integrity", "relevance", "timestamp", "independence"],
    confidence=0.95
)
```

### Partially Verified
Some checks failed:
```python
VerificationResult(
    status="PARTIALLY_VERIFIED",
    failed_checks=["independence"],
    confidence=0.7
)
```

### Failed
Critical check failed:
```python
VerificationResult(
    status="FAILED",
    failed_checks=["integrity"],
    confidence=0.0
)
```

### Unverifiable
Cannot verify:
```python
VerificationResult(
    status="UNVERIFIABLE",
    reason="Source unavailable",
    confidence=0.0
)
```

## Source Relationships

### Detecting Dependencies
```python
def detect_dependencies(sources):
    # Check if sources share common backend
    # Check if sources reference each other
    # Check if sources use same API
    return dependencies
```

### Independence Score
```python
def calculate_independence_score(evidences):
    total = len(evidences)
    independent = count_independent_sources(evidences)
    return independent / total
```

---

# Consensus Mechanism

## Overview

AgentCourt uses a multi-stage consensus process to ensure fair dispute resolution.

## Stage 1: Independent Evaluation

Multiple evaluators independently analyze the same evidence:

```python
evaluator_results = []
for role in ("neutral", "claimant_advocate", "respondent_advocate", "auditor"):
    prompt = build_evaluation_prompt(case, fetches, role)
    raw = gl.nondet.exec_prompt(prompt, response_format="json")
    norm = normalize_evaluator(raw, role)
    if norm is not None:
        evaluator_results.append(norm)
```

Each evaluator returns a verdict label of `SUPPORTED`, `REFUTED`, or `INCONCLUSIVE` plus a confidence score.

## Stage 2: Agreement Analysis

Compare evaluator conclusions:

- **Strong Consensus**: All evaluators agree
- **Majority Consensus**: Most evaluators agree
- **Weak Consensus**: Limited agreement
- **No Consensus**: Evaluators disagree

## Stage 3: Contradiction Detection

Identify conflicting conclusions:

```python
verdicts = [r.verdict for r in evaluator_results]
if len(set(verdicts)) > 1:
    # Contradiction detected
    investigate_reasons(evaluator_results)
```

## Stage 4: Adversarial Review

Challenge the current conclusion:

```python
adv_prompt = build_adversarial_prompt(case, fetches, evaluators)
adversarial = normalize_adversarial(
    gl.nondet.exec_prompt(adv_prompt, response_format="json")
)
```

## Stage 5: Final Consensus

Produce final state, verdict, confidence (basis points), and review flag:

```python
state, verdict, confidence_bp, review_required = classify_evaluation(
    tally, adversarial
)
```

## Implementation in AgentCourtCore

The full pipeline runs inside `AgentCourtCore.request_evaluation` under GenLayer validator consensus (`gl.vm.run_nondet_unsafe`); validators re-run the leader's computation and accept it only if `substantive_match` passes.

Protocol constants:

```python
EVALUATOR_ROLES = ("neutral", "claimant_advocate", "respondent_advocate", "auditor")
MIN_VALID_EVALUATORS = 2
AGREEMENT_CONSENSUS_THRESHOLD = 0.6
```

Classification rules:

- Fewer than 2 valid evaluators → `INCONCLUSIVE` (UNVERIFIABLE, review required)
- Majority `INCONCLUSIVE` → `INCONCLUSIVE`
- Agreement < 0.6 with ≥ 2 distinct verdicts → `DISPUTED` (REVIEW, review required)
- Agreement < 0.6 → `INCONCLUSIVE`
- Otherwise → `CONSENSUS` with `TRUE` (majority SUPPORTED) or `FALSE` (majority REFUTED)

Possible consensus states: `CONSENSUS`, `INCONCLUSIVE`, `DISPUTED`, `EVALUATION_FAILED`.

---

# Adversarial Review

## Purpose

The adversarial reviewer challenges initial conclusions to prevent:
- Correlated reasoning errors
- Uncritical acceptance of evidence
- Single-perspective bias
- Manipulation through persuasion

## Review Process

The adversarial pass runs inside `AgentCourtCore.request_evaluation`, after the role-based evaluators and before consensus classification:

```python
adv_prompt = build_adversarial_prompt(case, fetches, evaluators)
adversarial = normalize_adversarial(
    gl.nondet.exec_prompt(adv_prompt, response_format="json")
)
```

## Output Schema

```json
{
  "challenges": [
    {
      "type": "assumption",
      "description": "...",
      "severity": 3,
      "affectsVerdict": true
    }
  ],
  "verdictUpheld": false,
  "reasoning": "...",
  "confidenceAdjustment": -20
}
```

## Effect on Consensus

- `verdictUpheld: false` caps the final confidence at 40% (4000 bp) and forces `reviewRequired`
- `confidenceAdjustment` (in points) is added to the evaluators' average confidence
- Any MISLEADING / UNVERIFIABLE / REVIEW verdict always requires review

## Challenge Questions

### Evidence Quality
- Is the source reliable?
- Could the evidence be fabricated?
- Is there corroborating evidence?
- Are the timestamps trustworthy?

### Agreement Interpretation
- Is the agreement clear?
- Are terms ambiguous?
- Could it be interpreted differently?

### Reasoning Soundness
- Are assumptions explicit?
- Is logic valid?
- Are there logical fallacies?
- Is causation proven?

### Source Independence
- Are sources truly independent?
- Do they share common dependencies?
- Could one source influence others?

## Challenge Strength

### Weak Challenge
- Minor concerns
- Doesn't change verdict
- Reduces confidence slightly

### Moderate Challenge
- Material concerns
- May change verdict
- Requires re-evaluation

### Strong Challenge
- Critical flaw identified
- Verdict likely wrong
- Recommends REVIEW

## Integration with Consensus

`verdictUpheld` and `confidenceAdjustment` feed directly into `classify_evaluation` — see [Consensus Mechanism](#consensus-mechanism).

---

# Settlement Rules

## Overview

Settlement is deterministic based on finalized verdicts.

## Resolution Types

### RELEASE_TO_CLAIMANT
- Dispute resolved in favor of claimant
- Escrow funds released to claimant
- Bond returned to claimant

### RELEASE_TO_RESPONDENT
- Dispute resolved in favor of respondent
- Escrow funds released to respondent
- Bond returned to respondent

### SPLIT
- Partial resolution for both parties
- Funds split according to agreement terms
- Proportional bond return

### FREEZE
- Insufficient evidence to decide
- Funds remain in escrow
- Awaits additional evidence or appeal

### SLASH
- Malicious behavior detected
- Bond forfeited as penalty
- Funds may be burned or redistributed

### REVIEW
- Requires human intervention
- Complex or ambiguous case
- Preserved for manual resolution

## Verdict → Resolution Mapping

| Verdict | Resolution |
|---|---|
| TRUE | RELEASE_TO_CLAIMANT |
| FALSE | RELEASE_TO_RESPONDENT |
| MISLEADING | REVIEW |
| UNVERIFIABLE | FREEZE |
| REVIEW | FREEZE |

The mapping is derived on-chain by `resolution_for_verdict`; callers cannot choose the resolution.

## Settlement Flow

```
Verdict Finalized (AgentCourtCore)
      ↓
execute_settlement (AgentCourtCore)
      ↓   requires status VERDICT, verdict not superseded,
      ↓   and reviewRequired == false
ResolutionManager.execute_settlement  (core-only)
      ↓
Settlement recorded (nonce + resolution + verdict snapshot)
      ↓
Dispute Closed
```

ResolutionManager re-verifies the verdict by reading it back from AgentCourtCore and refuses when the verdict is missing, frozen (`reviewRequired`), or already settled. Actual fund movement is performed by the integrating escrow/settlement application, which consumes the recorded settlement.

## Idempotency

Settlement operations are idempotent:
- ResolutionManager marks the dispute settled before recording the nonce
- Same dispute cannot settle twice (`"Dispute already settled"`)
- Settlement nonce prevents replay; safe to retry on failure

---

# AgentCourt vs Alternatives

## vs Traditional Arbitration

| Aspect | Traditional | AgentCourt |
|---|---|---|
| Speed | Days to weeks | Minutes to hours |
| Cost | High fees | Low gas costs |
| Transparency | Private | Public audit |
| Scalability | Limited | Unlimited |
| Automation | Manual | Autonomous |

## vs Centralized Moderation

| Aspect | Centralized | AgentCourt |
|---|---|---|
| Trust | Company | Protocol |
| Appeal | Limited | Built-in |
| Evidence | Internal | On-chain |
| Settlement | Manual | Automated |
| Censorship | Possible | Resistant |

## vs Simple AI Judge

| Aspect | AI Judge | AgentCourt |
|---|---|---|
| Evidence | Optional | Required |
| Review | None | Adversarial |
| Consensus | Single model | Multiple evaluators |
| Appeal | No | Yes |
| Settlement | Manual | Deterministic |

## vs Traditional Smart Contracts

| Aspect | Smart Contracts | AgentCourt |
|---|---|---|
| Logic | Deterministic | Judgment-based |
| Data | On-chain only | On-chain + web |
| Disputes | External | Built-in |
| Complexity | Simple | Complex reasoning |
| Use cases | Finance | Commerce, services |

---

# Glossary

## Core Terms

**Dispute**: A formal disagreement between two parties about whether an agreement was fulfilled.

**Evidence**: Verifiable data supporting or contradicting a claim in a dispute.

**Verdict**: The final determination of a dispute based on evidence analysis.

**Settlement**: The execution of consequences based on a finalized verdict.

## Agent Types

**Claimant**: The party initiating a dispute.

**Respondent**: The party against whom the dispute is filed.

**Evaluator**: An independent AI that analyzes evidence and produces a conclusion.

**Adversary**: A reviewer that challenges initial conclusions.

## Contract Types

**Intelligent Contract (IC)**: A Python-based contract running on GenLayer with AI capabilities.

**Ghost Contract**: An EVM-facing contract that routes calls between GenLayer Chain and GenVM.

**Registry**: A contract that stores persistent data.

**Adapter**: A contract that connects AgentCourt to external systems.

## Status Types

**OPEN**: Dispute created, awaiting evidence.

**EVIDENCE_COLLECTION**: Parties submitting evidence.

**INVESTIGATION**: System analyzing evidence.

**DELIBERATION** / **ADVERSARIAL_REVIEW** / **CONSENSUS**: Transitional phases within the evaluation pipeline.

**EVALUATION_PENDING**: Evaluation submitted, awaiting validator consensus.

**EVALUATION_FAILED**: The evaluation pipeline failed; can be re-run.

**INCONCLUSIVE**: Not enough valid evaluator agreement; review required.

**DISPUTED**: Evaluators materially disagree; review required.

**VERDICT**: Final determination made.

**SETTLEMENT**: Settlement being executed.

**CLOSED**: Dispute fully resolved.

**APPEALED**: An appeal was opened against a finalized verdict.

## Evaluation Terms

**SUPPORTED**: Evaluator verdict that the claim is supported by the evidence.

**REFUTED**: Evaluator verdict that the claim is contradicted by the evidence.

**INCONCLUSIVE (label)**: Evaluator could not determine a verdict.

**Confidence (basis points)**: Verdict confidence stored as bp; 10000 = 100.00%.
