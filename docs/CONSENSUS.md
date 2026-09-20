# Consensus Mechanism

## Overview

AgentCourt uses a multi-stage consensus process to ensure fair dispute resolution.

## Stage 1: Independent Evaluation

Multiple evaluators independently analyze the same evidence:

```python
evaluator_results = []
for evaluator in evaluators:
    result = evaluator.analyze(evidence, agreement, claim)
    evaluator_results.append(result)
```

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
adversary = AdversarialReviewer()
challenges = adversary.review(
    initial_verdict,
    evidence,
    agreement,
    claim
)
```

## Stage 5: Final Consensus

Produce final verdict with confidence score:

```python
final_verdict = consensus.build(
    evaluator_results,
    challenges,
    confidence_threshold=0.8
)
```
