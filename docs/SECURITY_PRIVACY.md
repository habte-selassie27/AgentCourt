# AgentCourt Security & Privacy

> Consolidated from: `SECURITY_MODEL.md`, `PRIVACY.md`

## Contents

1. [Security Model](#security-model)
2. [Privacy Considerations](#privacy-considerations)

---

# Security Model

## Threat Model

Potential attackers include:
- Malicious claimants
- Malicious respondents
- Compromised evidence providers
- Prompt injectors
- Sybil evaluators
- Colluding evaluators

## Defense Mechanisms

### Evidence Provenance
- Track evidence source chain
- Verify cryptographic hashes
- Validate timestamps

### Source Diversity
- Require multiple independent sources
- Detect source relationships
- Cross-validate claims

### Independent Reasoning
- Multiple evaluators analyze separately
- Compare conclusions
- Detect correlated failures

### Adversarial Review
- Challenge initial conclusions
- Identify weakest assumptions
- Find contradictory evidence

### Economic Security
- Require bonds for disputes
- Slash bonds for malicious behavior
- Reward honest participants

## Fail-Closed Design

When uncertain, AgentCourt defaults to:
- REVIEW state (not automatic settlement)
- Require human intervention
- Preserve evidence for audit

---

# Privacy Considerations

## On-Chain Data

### What's Stored On-Chain
- Dispute metadata (parties, type, status)
- Evidence hashes (not raw content)
- Verdicts and settlements
- Timestamps

### What's NOT Stored On-Chain
- Raw evidence content
- Personal information
- Private keys
- API credentials

## Evidence Privacy

### Hash-Based Verification
```
Raw Evidence → Hash → On-Chain Reference
```

Benefits:
- Proves existence without revealing content
- Tamper-evident
- Storage efficient

### Encrypted Evidence (Future)
```
Evidence → Encrypt → Store off-chain
                ↓
        Hash on-chain
                ↓
        Decryption key shared with authorized parties
```

## Zero-Knowledge Proofs (Future)

### ZK Evidence
Prove facts without revealing data:
```python
# Example: Prove age > 18 without revealing birthdate
proof = zk_prove(age > 18, private_input=birthdate)
```

### zkTLS
Prove web data without exposing credentials:
```python
# Example: Prove account balance without revealing password
proof = zktls.prove("balance > 1000", session=web_session)
```

## Data Retention

### Dispute Data
- Retained for audit purposes
- Can be pruned after finalization
- Hashes remain for verification

### Evidence Data
- Referenced by hash
- Original storage responsibility of submitter
- AgentCourt doesn't store raw data

## Compliance

### GDPR Considerations
- Right to erasure: Prune off-chain data
- Data minimization: Only store necessary hashes
- Transparency: Verdicts are public

### Audit Trail
- All events logged
- Verifiable timestamps
- Tamper-evident hashes
