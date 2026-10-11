# pi-bot

[![CI](https://github.com/luodaoyi/pi-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/luodaoyi/pi-bot/actions/workflows/ci.yml)

Open-source port of DeepSeek-Bot to [pi coding agent](https://github.com/Earendil-Labs/Pi) with Respire memory system integration.

## Overview

pi-bot is a multi-bot daemon built on the Pi SDK that provides:

- **Multi-bot Management**: Run multiple AI assistants simultaneously with different roles and capabilities
- **Session Pooling**: Efficient session management with automatic idle cleanup
- **Team Coordination**: Inter-bot messaging and collaborative problem-solving
- **Group Chat**: Multi-bot group discussions with configurable speaking modes
- **Respire Memory**: Persistent long-term memory via the Respire runtime
- **HTTP/SSE API**: RESTful API with Server-Sent Events for real-time updates
- **Web UI**: Modern React-based interface (separate package)

## Packages

This monorepo contains:

- **`pi-bot`**: Main daemon with HTTP server, bot management, and coordination
- **`pi-respire`**: Pi extension providing Respire memory integration
- **`@pi-bot/respire-client`**: TypeScript client for Respire Runtime HTTP RPC
- **`@pi-bot/shared`**: Shared types and utilities
- **`@pi-bot/web`**: React web interface (coming soon)

## Pi Package Gallery

pi-bot is discoverable in Pi's official package gallery. To appear in the gallery, packages must include:

- **Keywords**: `pi-package` and `pi-coding-agent` in `package.json`
- **Pi Manifest**: The `pi` field with:
  - `extensions`: Array of extension entry points
  - `image` (optional): Cover image URL for gallery display
  - `homepage` (optional): Package homepage URL
- **Standard Metadata**: `description`, `repository`, `homepage`, `license`

See [pi documentation](https://github.com/earendil-works/pi) for details.

## Prerequisites

- **Node.js**: >= 22.19.0 (requires `node:sqlite` for built-in SQLite support)
- **Pi Coding Agent**: [@earendil-works/pi-coding-agent](https://github.com/earendil-works/pi) >= 1.1.0
- **Respire Runtime**: [rsrs](https://github.com/cablehead/xs) for memory backend (optional)

## Installation

### Via npm (when published)

```bash
npm install -g pi-bot pi-respire
```

### From source

```bash
git clone https://github.com/luodaoyi/pi-bot.git
cd pi-bot
pnpm install
pnpm -r build
```

## Quick Start

1. **Start the daemon:**

```bash
pi-bot serve
```

The server starts on `http://localhost:16888` by default.

2. **Create your first bot:**

```bash
curl -X POST http://localhost:16888/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Assistant",
    "role": "Helper",
    "instructions": "You are a helpful coding assistant.",
    "model": {
      "provider": "deepseek",
      "modelId": "deepseek-chat"
    }
  }'
```

3. **Send a message:**

```bash
curl -X POST http://localhost:16888/api/bots/bot-xxx/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello! Can you help me with Python?"
  }'
```

## Configuration

Configure via environment variables or `~/.pi-bot/config.json`:

```json
{
  "host": {
    "apiPort": 16888,
    "home": "~/.pi-bot"
  },
  "respire": {
    "port": 15169,
    "autostart": true
  },
  "pi": {
    "defaultModel": "deepseek/deepseek-chat"
  }
}
```

## Memory System

pi-bot integrates with Respire for long-term memory:

- **Automatic Memory**: Bots can store and recall information across sessions
- **Scoped Memory**: Per-bot, team-shared, or project-specific memory
- **Semantic Search**: Query memories by natural language
- **Policy-Based**: Configurable recall policies and memory modes

Memory is automatically enabled when Respire runtime is available. Set `RSRS_RPC_PORT` to customize the connection.

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm -r typecheck

# Lint
pnpm -r lint

# Test
pnpm -r test

# Build
pnpm -r build

# Run in development mode
pnpm --filter pi-bot dev
```

## API Documentation

See [`docs/api.md`](./docs/api.md) for complete HTTP API reference.

Key endpoints:

- `GET /api/bots` - List all bots
- `POST /api/bots` - Create bot
- `POST /api/bots/:id/messages` - Send message
- `GET /api/events` - SSE event stream

## Publishing to npm

### One-time Setup (Repository Maintainer)

1. **Configure npm Trusted Publishing with OIDC:**

```bash
# Go to https://www.npmjs.com/settings/<your-username>/tokens
# Click "Generate New Token" → "Granular Access Token"
# Select packages: pi-bot, pi-respire
# Enable "Automation" scope
# Copy the token
```

2. **Add GitHub Secret:**

```bash
# Go to GitHub repo → Settings → Secrets and variables → Actions
# Click "New repository secret"
# Name: NPM_TOKEN
# Value: <paste token>
```

3. **Enable Provenance:**

The release workflow automatically uses `--provenance` flag for supply chain transparency.

### Publishing a Release

1. **Update version in all packages:**

```bash
cd packages/pi-bot && npm version patch  # or minor, major
cd ../pi-respire && npm version patch
git commit -am "chore: bump version to 0.x.x"
```

2. **Push and tag:**

```bash
git tag v0.x.x
git push origin main --tags
```

GitHub Actions will automatically:
- Build all packages
- Publish to npm with provenance
- Create GitHub release with auto-generated notes

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0

## Credits

Inspired by [DeepSeek-Bot](https://github.com/deepseek-ai/DeepSeek-Bot) and powered by:

- [Pi Coding Agent](https://github.com/Earendil-Labs/Pi)
- [Respire Memory System](https://github.com/cablehead/xs)
- [Hono](https://hono.dev/) web framework

---

**Status**: Early development. API may change.
