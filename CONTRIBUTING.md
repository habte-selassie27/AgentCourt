# Contributing to AgentCourt

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your keys
4. Run development server: `npm run dev`

## Code Style

- Python contracts follow GenLayer conventions
- TypeScript follows ESLint rules
- Commit messages use conventional commits format

## Testing

- Python acceptance tests (IC workflow + caller isolation): `pytest tests/unit/ -v`
- Frontend domain tests: `npm test`
- Smart-contract lint: `genvm-lint check intelligent-contracts/core/agentcourt_core.py` and `.../registry/resolution_manager.py`
- Typecheck + build: `npm run typecheck && npm run build`

There is no Solidity/Foundry test path — only Python Intelligent Contracts.

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add tests if applicable
4. Update documentation if needed
5. Submit a pull request

## Security

Never commit private keys or sensitive data. Use environment variables.
