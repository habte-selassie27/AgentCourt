# Testing Guide

## Unit Tests

### Python Tests
```bash
# Run all unit tests
pytest tests/unit/ -v

# Run specific test file
pytest tests/unit/test_dispute_judge.py -v

# Run with coverage
pytest tests/unit/ --cov=intelligent-contracts
```

### TypeScript Tests
```bash
# Run all tests
npm test

# Run specific test
npm test -- tests/sdk.agentcourt.test.ts

# Run with watch mode
npm test -- --watch
```

## Integration Tests

```bash
# Run against localnet
gltest tests/integration/ -v -s --network localnet

# Run against testnet
gltest tests/integration/ -v -s --network testnet_bradbury
```

## Direct Tests

```bash
# Fast in-memory tests (~30ms each)
pytest tests/direct/ -v
```

## Adversarial Tests

Test against:
- Prompt injection attempts
- Fake evidence submissions
- Colluding evaluators
- Source manipulation

## CI/CD

Tests run automatically on:
- Pull requests
- Main branch pushes
- Nightly builds
