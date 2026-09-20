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
