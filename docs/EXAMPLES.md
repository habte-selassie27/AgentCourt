# Examples

## Creating a Dispute

```typescript
const court = new AgentCourt(config);

const disputeId = await court.createDispute({
  respondent: '0x1234...5678',
  agreementHash: keccak256(toUtf8Bytes('dataset delivery')),
  claimType: 'DELIVERY_FAILURE',
  description: 'Agent B failed to deliver the dataset',
  stake: parseEther('0.001'),
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
});
```

## Submitting Evidence

```typescript
await court.submitEvidence({
  disputeId,
  evidenceType: 'ONCHAIN_TRANSACTION',
  source: 'chain',
  refUri: '0xabc...def',
  contentHash: keccak256(toUtf8Bytes('payment proof')),
  description: 'Payment transaction confirming delivery',
});
```

## Getting Verdict

```typescript
const verdict = await court.getVerdict(disputeId);
if (verdict) {
  console.log(`Verdict: ${verdict.verdict}`);
  console.log(`Confidence: ${verdict.confidence}`);
  console.log(`Resolution: ${verdict.resolution}`);
}
```

## Waiting for Verdict

```typescript
const verdict = await court.waitForVerdict(disputeId, 300000);
```
