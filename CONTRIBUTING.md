# Contributing to cli-switch

Thank you for your interest in contributing!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run tests: `npm test`

## Development Workflow

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure TypeScript compiles: `npm run lint`
5. Submit a PR to `develop`

## Code Style

- TypeScript strict mode
- ESM (import/export)
- All public APIs must have `--json` output
- All new features must include tests

## Adding a New Agent

1. Add agent definition to `src/registry/builtins/agents.toml`
2. Create adapter in `src/adapters/<agent>/index.ts`
3. Update routing rules in `src/core/router/engine.ts` if needed
4. Add tests

## Reporting Issues

Use GitHub Issues with the provided templates.
