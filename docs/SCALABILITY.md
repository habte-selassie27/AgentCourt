# Scalability Analysis

## Current Capacity

### GenLayer Studionet Limits
- 32 pending transactions per sender
- Per-contract caps apply
- Rate limits: 60 req/min, 1000 req/hr

### AgentCourt Throughput
- Evidence submission: ~5s per transaction
- Investigation: ~30s per dispute
- Deliberation: ~60s per dispute
- Verdict: ~30s per dispute
- Settlement: ~10s per dispute

## Bottlenecks

### Cross-Contract Calls
Each dispute requires multiple cross-contract calls:
1. Create dispute → AgentCourtCore
2. Submit evidence → DisputeRegistry
3. Verify evidence → EvidenceVerifier
4. Judge dispute → DisputeJudge
5. Adversarial review → AdversarialReviewer
6. Consensus → ConsensusEngine
7. Finalize verdict → AgentCourtCore
8. Settle → ResolutionManager

### Sequential Execution
- emit() calls are asynchronous
- Can't parallelize within single dispute
- Can process multiple disputes in parallel

## Optimization Strategies

### Batching
```python
# Batch evidence submissions
def submit_evidence_batch(dispute_id, evidence_list):
    for evidence in evidence_list:
        self.submit_evidence(dispute_id, evidence)
```

### Caching
```python
# Cache dispute data in AgentCourtCore
self.disputes[dispute_id] = dispute
# Avoid repeated cross-contract reads
```

### Lazy Verification
```python
# Verify evidence only when needed
def verify_evidence(self, evidence_id):
    if not self.evidence_verified[evidence_id]:
        # Verify on demand
        self._verify(evidence_id)
```

## Horizontal Scaling

### Multiple DisputeRegistries
```
AgentCourtCore
    ├── DisputeRegistry A
    ├── DisputeRegistry B
    └── DisputeRegistry C
```

### Sharding
- Partition disputes by type
- Assign to different registries
- Aggregate verdicts across shards

## Future Improvements

### Layer 2 Integration
- Process disputes off-chain
- Batch settlement on-chain
- Reduce gas costs

### Parallel Processing
- Independent evidence verification
- Concurrent evaluator analysis
- Async adversarial review

### Caching Layer
- Cache frequently accessed data
- Reduce cross-contract reads
- Improve response times
