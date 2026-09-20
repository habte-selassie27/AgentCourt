# Monitoring Guide

## Key Metrics

### Dispute Metrics
- Total disputes created
- Disputes by type
- Average resolution time
- Settlement success rate
- Appeal rate

### Evidence Metrics
- Evidence submissions per dispute
- Source diversity score
- Verification success rate
- External source availability

### Performance Metrics
- Average investigation time
- Average deliberation time
- Consensus achievement rate
- Adversarial review impact

## Health Checks

### Contract Status
```typescript
async function checkHealth() {
  const core = new ethers.Contract(CORE_ADDRESS, abi, provider);
  
  const isPaused = await core.is_paused();
  const disputeCount = await core.get_next_dispute_id();
  
  return {
    paused: isPaused,
    disputes: disputeCount.toString(),
    status: isPaused ? 'degraded' : 'healthy'
  };
}
```

### Explorer Links
- AgentCourtCore: https://explorer-studio.genlayer.com/address/0x1201eF62b96133c652c668e200C096D16BcaD0CF
- DisputeRegistry: https://explorer-studio.genlayer.com/address/0x57802A80B38c68a7EbE814F4249a8Ac6768319b4

## Alerting

### Critical Alerts
- Contract paused unexpectedly
- Settlement failures
- Dispute stuck in state > 1 hour
- Evidence verification failures

### Warning Alerts
- High dispute rate
- Low consensus rate
- Source availability < 90%
- Appeal rate increasing

## Logging

### Structured Logs
```json
{
  "event": "DISPUTE_CREATED",
  "dispute_id": 42,
  "claimant": "0x...",
  "claim_type": "DELIVERY_FAILURE",
  "timestamp": "2026-09-20T10:30:00Z"
}
```

### Event Trail
Every dispute produces:
1. DISPUTE_CREATED
2. EVIDENCE_SUBMITTED
3. INVESTIGATION_STARTED
4. EVIDENCE_VERIFIED
5. DELIBERATION_STARTED
6. ADVERSARIAL_REVIEW_STARTED
7. CONSENSUS_REACHED
8. VERDICT_FINALIZED
9. SETTLEMENT_EXECUTED
