# Evidence Model

## Evidence Types

### On-Chain Transaction
- Blockchain transaction hash
- Block timestamp
- Sender/receiver addresses
- Value transferred

### Web Page
- URL reference
- Content hash
- Retrieval timestamp
- Page snapshot

### API Response
- Endpoint URL
- Response body hash
- Request timestamp
- Response headers

### Signed Message
- Signer address
- Message content
- Signature
- Timestamp

## Evidence Verification

Evidence undergoes multiple verification stages:

1. **Existence**: Does the evidence exist?
2. **Relevance**: Is it related to the dispute?
3. **Integrity**: Has it been tampered with?
4. **Independence**: Are sources independent?
5. **Corroboration**: Do multiple sources agree?

## Source Independence

AgentCourt tracks source relationships to prevent:

- Multiple URLs pointing to same backend
- Circular references
- Single-source dependencies
