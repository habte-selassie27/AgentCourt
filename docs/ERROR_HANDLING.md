# Error Handling

## Contract Errors

### UserError
Custom error messages for user-facing errors:

```python
raise gl.UserError("Not owner")
raise gl.UserError("Contract is paused")
raise gl.UserError("Dispute already settled")
```

### Expected Errors
Normal business logic errors:
- Dispute doesn't exist
- Evidence already verified
- Verdict already finalized

### External Errors
Errors from external systems:
- Source unavailable
- API timeout
- Invalid response

### Transient Errors
Temporary failures:
- Network timeout
- Rate limiting
- Node sync issues

## Frontend Errors

### Wallet Not Connected
```typescript
if (!signer) {
  throw new Error('Wallet not connected');
}
```

### Contract Not Deployed
```typescript
const code = await provider.getCode(address);
if (!code || code === '0x') {
  throw new Error('Contract not deployed');
}
```

### Transaction Failed
```typescript
try {
  const tx = await contract.method();
  await tx.wait();
} catch (error) {
  console.error('Transaction failed:', error);
}
```

## Retry Strategy

For transient errors:
1. Wait exponential backoff
2. Retry up to 3 times
3. Log failure details
4. Escalate if persistent
