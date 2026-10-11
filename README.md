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

**Requirements:** Node.js >= 22.19.0 (for built-in `node:sqlite` support)

There are two ways to run pi-bot:

### Option 1: Global CLI (npm or pnpm)

Install globally and use the `pi-bot` CLI:

**Using npm:**
```bash
npm install -g pi-agent-bot@beta
```

**Using pnpm:**
```bash
pnpm add -g pi-agent-bot@beta
# First time: Run 'pnpm setup' to configure global bin directory if needed
```

Then start the daemon and open the web GUI:

```bash
pi-bot open
# or manually start: pi-bot serve
# check status: pi-bot status
# stop daemon: pi-bot stop
```

**Note for pnpm users:** If `pi-bot` command is not found after installation, run `pnpm setup` to add pnpm's global bin directory to your PATH, then restart your shell.

### Option 2: Pi Extension (within Pi)

Install as a Pi package to get the `/pi-bot` slash command:

```bash
pi install npm:pi-agent-bot
```

Then inside a Pi session:

```
/pi-bot         # Opens web GUI (starts daemon if needed)
/pi-bot status  # Check daemon status
/pi-bot stop    # Stop the daemon
```

Both methods share the same daemon instance at `~/.pi-bot`, so you can use either entry point interchangeably.

### From source

```bash
git clone https://github.com/luodaoyi/pi-bot.git
cd pi-bot
pnpm install
pnpm -r build
```

## Quick Start

The daemon starts on `http://localhost:8787` by default. Use `pi-bot open` or `/pi-bot` to start the daemon and open the web GUI in your browser.

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

Configure via environment variables or `~/.pi-bot/config.json` (CLI uses `pi-bot` command):

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

#### 1. Update CHANGELOG.md

Follow [Keep a Changelog](https://keepachangelog.com/) format. Add a new section for the upcoming version with:
- Summary in English and Chinese (摘要)
- Grouped changes: Added / Fixed / Changed / Deprecated / Removed / Security
- Link each change to its commit SHA (e.g., `([abc1234](https://github.com/luodaoyi/pi-bot/commit/abc1234))`)
- Link merged PRs (e.g., `[#123](https://github.com/luodaoyi/pi-bot/pull/123)`)
- Document known issues

Example:
```markdown
## [0.1.0-beta.5] - 2026-10-12

### Summary / 摘要

**New feature X.** Brief description in English.

**新功能X。** 简要中文描述。

### Added / 新增

- Feature description ([abc1234](https://github.com/luodaoyi/pi-bot/commit/abc1234)) [#10](https://github.com/luodaoyi/pi-bot/pull/10)
  - 中文描述

### Fixed / 修复

- Bug fix description ([def5678](https://github.com/luodaoyi/pi-bot/commit/def5678))
  - 中文描述
```

#### 2. Bump version in package.json

```bash
# For beta releases
npm version prerelease --preid=beta

# For production releases  
npm version patch  # or minor, major
```

Commit the version bump:
```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.x.x"
git push origin main
```

#### 3. Create and push the release tag

```bash
# Tag must match the version in package.json
VERSION=$(node -p "require('./package.json').version")
git tag v$VERSION
git push origin v$VERSION
```

#### 4. Automated release workflow

The `.github/workflows/release.yml` workflow will automatically:

1. **Verify** package.json version matches the git tag
2. **Build** the project and web UI
3. **Test** all code (lint, typecheck, unit tests)
4. **Check** if version already exists on npm
5. **Publish** to npm with OIDC trusted publishing and provenance
6. **Generate** detailed release notes from CHANGELOG.md:
   - Extract the matching CHANGELOG section
   - Add commit log with linked SHAs and PRs
   - Add installation instructions (npm, pnpm, Pi CLI)
   - Add full changelog compare link
7. **Create** GitHub Release with generated notes and tarball attachment

#### 5. Release notes requirements

**Every GitHub Release MUST have detailed notes.** The workflow will fail if:
- No matching CHANGELOG.md section found
- Generated release notes are too short (< 10 lines)

Release notes include:
- **What's Changed**: CHANGELOG summary and grouped changes
- **Commits**: Full commit log with SHAs and PR links
- **Installation**: npm/pnpm/pi install commands
- **Full Changelog**: Compare link to previous version

#### 6. Backfilling existing releases

To update release notes for existing versions:

```bash
./scripts/backfill-releases.sh
```

This script:
- Reads CHANGELOG.md for each version
- Generates comprehensive release notes
- Updates GitHub Releases via `gh release edit`

#### 7. Verify the release

After the workflow completes:

```bash
# Check npm publication
npm view pi-agent-bot dist-tags
npm view pi-agent-bot@beta

# Check GitHub Release
gh release view v0.x.x

# Verify tarball
npm pack pi-agent-bot@beta
tar -tzf pi-agent-bot-*.tgz | head -20
```

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
