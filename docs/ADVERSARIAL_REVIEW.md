# Adversarial Review

## Purpose

The adversarial reviewer challenges initial conclusions to prevent:
- Correlated reasoning errors
- Uncritical acceptance of evidence
- Single-perspective bias
- Manipulation through persuasion

## Review Process

### Step 1: Receive Initial Conclusion
```python
initial_verdict = judge.analyze(evidence, agreement, claim)
```

### Step 2: Challenge Assumptions
```python
challenges = []
for assumption in initial_verdict.assumptions:
    challenge = question_assumption(assumption)
    if challenge.is_valid:
        challenges.append(challenge)
```

### Step 3: Find Contradictory Evidence
```python
contradictions = find_contradictions(
    evidence,
    initial_verdict.claims
)
```

### Step 4: Test Interpretation
```python
alternative_interpretations = generate_alternatives(
    evidence,
    agreement
)
```

### Step 5: Produce Challenge Report
```python
report = {
    "challenges": challenges,
    "contradictions": contradictions,
    "alternatives": alternative_interpretations,
    "strength": assess_challenge_strength(challenges)
}
```

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

Adversarial review feeds into consensus:
```python
final_verdict = consensus.build(
    initial_verdict,
    adversarial_challenges,
    confidence_threshold=0.8
)
```
