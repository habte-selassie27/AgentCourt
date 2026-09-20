# SDK Reference

## Installation

```bash
npm install @agentcourt/sdk
```

## Configuration

```typescript
import { createAgentCourt } from './sdk';

const court = createAgentCourt({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://studio.genlayer.com/api',
  chainId: 61999,
});
```

## Dispute Methods

### createDispute
```typescript
const disputeId = await court.createDispute({
  respondent: string,      // Address of respondent
  agreementHash: string,   // keccak256 of agreement
  claimType: string,       // e.g. 'DELIVERY_FAILURE'
  description: string,     // Human-readable claim
  stake: bigint,           // Stake in wei
  deadline: bigint,        // Unix timestamp deadline
}): Promise<number>
```

### submitEvidence
```typescript
await court.submitEvidence({
  disputeId: number,
  evidenceType: string,    // e.g. 'ONCHAIN_TRANSACTION'
  source: string,          // e.g. 'chain', 'web', 'api'
  refUri: string,          // Reference URI
  contentHash: string,     // keccak256 of content
  description: string,     // Description of evidence
}): Promise<number>
```

### getDispute
```typescript
const dispute = await court.getDispute(disputeId: number): Promise<Dispute | null>
```

### getVerdict
```typescript
const verdict = await court.getVerdict(disputeId: number): Promise<Verdict | null>
```

### waitForVerdict
```typescript
const verdict = await court.waitForVerdict(
  disputeId: number,
  timeout?: number         // Default: 300000ms (5 min)
): Promise<Verdict>
```

## Types

```typescript
interface Dispute {
  id: number;
  claimant: string;
  respondent: string;
  agreementHash: string;
  claimType: string;
  status: string;
  stake: bigint;
  deadline: number;
  createdAt: number;
}

interface Verdict {
  disputeId: number;
  verdict: string;         // TRUE | FALSE | MISLEADING | UNVERIFIABLE | REVIEW
  confidence: number;      // 0.0 - 1.0
  resolution: string;      // Settlement action
  evidenceRoot: string;
  reasoningHash: string;
}
```
