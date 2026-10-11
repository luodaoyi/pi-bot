# Pi Bot Extensions

This directory contains pi agent extensions for scheduler, secrets, and usage tracking features.

## Overview

These extensions integrate with the pi coding agent SDK to provide:

1. **Scheduler** - Tools for bots to manage their own scheduled tasks
2. **Secrets** - Secure secret management with masking and bash env injection  
3. **Usage** - Automatic token usage and cost tracking

## Usage

The session pool should call `createFeatureExtensions()` when creating pi agent sessions:

```typescript
import { createFeatureExtensions } from './extensions/index.js';
import { createAgentSession } from '@earendil-works/pi-coding-agent';

// Create feature extensions with dependencies
const features = createFeatureExtensions({
  scheduler,
  secrets,
  usage,
  getCurrentBotId: () => currentBot.id,
  getSessionId: () => session.id,
  getCwd: () => process.cwd(),
  onSecretRequest: (name, purpose, botId) => {
    // Show approval UI to user
    showSecretApprovalDialog(name, purpose, botId);
  },
});

// Create pi session with extensions
const { session } = await createAgentSession({
  extensionFactories: features.extensions,
  // Replace default bash tool with one that injects secrets
  tools: [
    features.createBashToolWithSecrets(cwd),
    // ... other default tools (edit, read, grep, etc.)
  ],
});
```

## Model-Facing Tools

### Scheduler Tools

- `schedule_create` - Create a scheduled task
  - Supports: cron, daily, weekly, every, at
  - Timezone-aware
  - Configurable missed-run policy

- `schedule_list` - List the bot's scheduled tasks

- `schedule_cancel` - Cancel a scheduled task by ID

### Secrets Tools

- `request_secret` - Request a secret value
  - Creates pending approval request
  - Never returns the value to the model
  - Makes value available as `PIBOT_SECRET_<NAME>` in bash

## Automatic Features

### Secret Masking

Secrets are automatically masked in:
- Tool results (`tool_result` hook)
- Context messages (`context` hook)
- Outbound provider requests (`before_provider_request` hook)

Values are replaced with `[secret:<NAME>]` placeholders.

### Bash Environment Injection

When a bot runs bash commands, approved secrets are automatically injected as environment variables:

```bash
# Bot can access secrets without seeing them in chat
echo $PIBOT_SECRET_API_KEY
curl -H "Authorization: Bearer $PIBOT_SECRET_API_KEY" ...
```

### Usage Tracking

Token usage is automatically recorded from `message_end` events with:
- Input/output/cache tokens
- Cost (when available)
- Provider and model
- Bot and session IDs

## Secret Detection

The secrets manager includes pattern-based detection for common secret formats:
- API keys (`sk-`, `ghp_`, `AKIA`, etc.)
- JWT tokens
- PEM certificates
- Password phrases (English and Chinese)
- Long numeric strings (IDs, phone numbers)

These patterns help prevent accidental storage of secrets in memory or logs.

## Architecture Notes

### Extension Return Values

Extensions can return:
- `void` - Simple extension with no special behavior
- `{ bashSpawnHook?: BashSpawnHook }` - Extension that modifies bash execution

The secrets extension returns a `bashSpawnHook` that injects environment variables.

### Hook Execution Order

Pi executes hooks in the order extensions are registered:
1. Scheduler (tools only)
2. Secrets (tools + hooks)
3. Usage (message_end hook)

### Scope-Based Access Control

Secrets support scope-based access control:
- `scope: 'all'` - Available to all bots
- `scope: ['bot-1', 'bot-2']` - Available only to specified bots

The session pool is responsible for enforcing this when creating pi sessions.

## Testing

Extensions are tested with mock pi sessions. Full integration testing requires a real pi agent session, which is provided by the session pool component.

See `index.test.ts` for extension creation and dependency injection tests.

## Better-sqlite3 vs node:sqlite

The usage tracker uses `better-sqlite3` by default for production quality and performance.

An alternative implementation using Node.js built-in `node:sqlite` is available in `usage/node-sqlite.ts` for environments where native modules are problematic:

```typescript
import { createUsageTrackerNodeSqlite } from './usage/node-sqlite.js';

const usage = await createUsageTrackerNodeSqlite({
  dbPath: join(homeDir, 'usage.sqlite'),
});
```

Note: `node:sqlite` is experimental in Node 22 and may change in future versions.
