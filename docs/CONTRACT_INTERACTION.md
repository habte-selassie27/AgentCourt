# Contract Interaction Guide

## AgentCourtCore

### Creating a Dispute
```typescript
// Frontend SDK
const disputeId = await court.createDispute({
  respondent: '0x...',
  agreementHash: keccak256(toUtf8Bytes('agreement')),
  claimType: 'DELIVERY_FAILURE',
  description: 'Service not delivered',
  stake: parseEther('0.001'),
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
});
```

### Submitting Evidence
```typescript
await court.submitEvidence({
  disputeId,
  evidenceType: 'ONCHAIN_TRANSACTION',
  source: 'chain',
  refUri: '0x...',
  contentHash: keccak256(toUtf8Bytes('content')),
  description: 'Payment proof',
});
```

### Getting Verdict
```typescript
const verdict = await court.getVerdict(disputeId);
```

## DisputeRegistry

### Read Operations
```python
# In Python IC
dispute = gl.get_contract_at(DISPUTE_REGISTRY).view().get_dispute(dispute_id)
evidence = gl.get_contract_at(DISPUTE_REGISTRY).view().get_evidence(evidence_id)
verdict = gl.get_contract_at(DISPUTE_REGISTRY).view().get_verdict(dispute_id)
```

### Write Operations
```python
# In AgentCourtCore
gl.get_contract_at(DISPUTE_REGISTRY).emit().create_dispute(...)
gl.get_contract_at(DISPUTE_REGISTRY).emit().add_evidence(...)
```

## ResolutionManager

### Opening Appeal
```python
gl.get_contract_at(RESOLUTION_MANAGER).emit().open_appeal(dispute_id)
```

### Executing Settlement
```python
gl.get_contract_at(RESOLUTION_MANAGER).emit().execute_settlement(dispute_id, resolution)
```

### Checking Settlement Status
```python
is_settled = gl.get_contract_at(RESOLUTION_MANAGER).view().is_settled(dispute_id)
```

## Event Listening

### Frontend
```typescript
const filter = court.core.filters.VerdictFinalized();
court.core.on(filter, (disputeId, verdict, confidence) => {
  console.log(`Dispute ${disputeId} finalized: ${verdict}`);
});
```

### Backend
```python
# Monitor events for automation
def on_dispute_created(event):
    dispute_id = event['args']['dispute_id']
    # Trigger investigation
```
