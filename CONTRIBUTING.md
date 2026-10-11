# Contributing to pi-bot

Thank you for your interest in contributing to pi-bot!

## Development Setup

1. **Prerequisites**
   - Node.js ≥ 22.19
   - pnpm ≥ 8.0
   - (Optional) Respire CLI for memory features

2. **Installation**
   ```bash
   git clone https://github.com/luodaoyi/pi-bot.git
   cd pi-bot
   pnpm install
   pnpm build
   ```

3. **Running Tests**
   ```bash
   pnpm test
   pnpm test:watch
   ```

4. **Development**
   ```bash
   # Run type checking
   pnpm typecheck
   
   # Run linter
   pnpm lint
   pnpm lint:fix
   ```

## Project Structure

- `packages/respire-client/` - Respire Runtime HTTP RPC client
- `packages/pi-respire/` - Pi extension for Respire integration
- `packages/pi-bot/` - Main daemon and API server
- `packages/shared/` - Shared types for API contracts

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Add tests for new functionality
4. Ensure all tests pass (`pnpm test`)
5. Update documentation as needed
6. Submit a pull request

## Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Write meaningful commit messages
- Add JSDoc comments for public APIs

## License

By contributing, you agree that your contributions will be licensed
under the Apache License 2.0.
