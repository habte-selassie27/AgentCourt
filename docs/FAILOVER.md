# Failover Strategies

## Source Failure

### External Source Unavailable
```
Source Timeout
    ↓
Retry (2 attempts)
    ↓
Alternative Source
    ↓
REVIEW if all fail
```

### Conflicting Sources
```
Source A: TRUE
Source B: FALSE
    ↓
Source Comparison
    ↓
Independent Verification
    ↓
Consensus Resolution
```

## Evaluator Failure

### Single Evaluator Timeout
```
Evaluator A: Timeout
Evaluator B: TRUE
Evaluator C: TRUE
Evaluator D: TRUE
    ↓
Majority Consensus
    ↓
Proceed with reduced confidence
```

### All Evaluators Disagree
```
Evaluator A: TRUE
Evaluator B: FALSE
Evaluator C: TRUE
Evaluator D: FALSE
    ↓
Adversarial Review
    ↓
Additional Evaluation
    ↓
REVIEW if unresolved
```

## Settlement Failure

### Transaction Reverted
```
Settlement Attempt
    ↓
Transaction Failed
    ↓
Retry with higher gas
    ↓
Manual Review if persistent
```

### Idempotency Protection
```
Settlement Nonce Check
    ↓
Already Settled → Skip
    ↓
Not Settled → Execute
```

## Emergency Procedures

### Pause Mechanism
```python
@External
def pause(self):
    assert gl.message.sender_address == self.owner
    self.paused = True

@External
def unpause(self):
    assert gl.message.sender_address == self.owner
    self.paused = False
```

### Emergency Settlement
For critical incidents:
1. Pause new disputes
2. Finalize pending verdicts
3. Execute settlements
4. Investigate post-mortem
