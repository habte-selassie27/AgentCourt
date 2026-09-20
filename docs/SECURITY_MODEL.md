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
