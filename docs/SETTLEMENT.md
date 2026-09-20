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

## Settlement Flow

```
Verdict Finalized
      ↓
Resolution Determined
      ↓
Settlement Executed
      ↓
Funds Transferred
      ↓
Dispute Closed
```

## Idempotency

Settlement operations are idempotent:
- Same dispute cannot settle twice
- Settlement nonce prevents replay
- Safe to retry on failure
