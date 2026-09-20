# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security@agentcourt.io (if available)
3. Include detailed steps to reproduce

## Security Model

AgentCourt follows a fail-closed architecture:

- External sources are never trusted automatically
- Single evaluator results are insufficient for high-value decisions
- Adversarial review challenges initial conclusions
- Uncertain outcomes default to REVIEW, not automatic settlement
- All verdicts expose evidence and reasoning for audit

## Smart Contract Security

- No direct AI fund control — reasoning produces verdicts, contracts settle
- Settlement operations are idempotent
- Replay protection via unique settlement nonces
- Emergency pause mechanism for critical incidents
