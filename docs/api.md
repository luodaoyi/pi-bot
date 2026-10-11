# pi-bot HTTP API Documentation

This document describes the HTTP API exposed by the pi-bot daemon.
The Web UI and external clients use this API.

## Base URL

Default: `http://localhost:8787`

Configurable via `PIBOT_LISTEN` environment variable or config file.

## Authentication

Development: No authentication (localhost only)
Production: Token-based (future)

## Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Endpoints

### Health

#### `GET /health`

Liveness. **No** `{success,data}` envelope.

```json
{ "status": "ok", "version": "0.1.0-beta.6", "pid": 123, "home": "...", "timestamp": "..." }
```

#### `GET /api/health`

Same payload wrapped as `{ "success": true, "data": { ... } }` for the GUI `ping()` client.

### Bots

#### `GET /api/bots`

List all bots.

**Response**: `ListBotsResponse`

```json
{
  "bots": [
    {
      "id": "bot-123",
      "name": "Assistant",
      "role": "helper",
      "instructions": "...",
      "model": {
        "provider": "deepseek",
        "modelId": "deepseek-chat"
      },
      "isMain": true,
      "created": "2026-01-01T00:00:00Z",
      "segments": ["session-abc"]
    }
  ]
}
```

#### `GET /api/bots/:id`

Get bot details.

**Response**: `GetBotResponse`

#### `POST /api/bots`

Create a new bot.

**Request**: `BotCreateRequest`

```json
{
  "name": "Writer",
  "role": "content creator",
  "instructions": "Help write articles",
  "model": {
    "provider": "deepseek",
    "modelId": "deepseek-chat"
  }
}
```

**Response**: `CreateBotResponse`

#### `PATCH /api/bots/:id`

Update a bot.

**Request**: `BotUpdateRequest`

**Response**: `UpdateBotResponse`

#### `DELETE /api/bots/:id`

Delete a bot. Only main bots can delete other bots.

**Response**: `DeleteBotResponse`

### Messages

#### `POST /api/messages`

Send a message to a bot.

**Request**: `SendMessageRequest`

```json
{
  "to": "bot-123",
  "message": "Hello!",
  "replyTo": "user"
}
```

**Response**: `SendMessageResponse`

#### `POST /api/questions`

Bot asks user a question (non-blocking).

**Request**: `AskUserRequest`

**Response**: `AskUserResponse`

#### `POST /api/questions/:id/answer`

Answer a pending question.

**Request**: `AnswerQuestionRequest`

### Groups

#### `GET /api/groups`

List all groups.

**Response**: `ListGroupsResponse`

#### `POST /api/groups`

Create a group.

**Request**: `GroupCreateRequest`

```json
{
  "name": "Team Chat",
  "members": ["bot-1", "bot-2"],
  "admin": ["bot-1"],
  "mode": "everyone"
}
```

**Response**: `CreateGroupResponse`

#### `POST /api/groups/:id/post`

Post a message to a group.

**Request**: `PostToGroupRequest`

### Memory (Respire RPC)

All GET memory routes return `{ success: true, data: { available, reason?, ... } }`.
When Respire is not running they still return **200** with `available: false` and `reason: "Respire not running"` — never an empty list that hides the error.

- `GET /api/memory/status`
- `GET /api/memory/search?query&scope&limit`
- `GET /api/memory/summary?scope&botId`
- `GET /api/memory/:id`
- `POST /api/memory/recall`
- `POST /api/memory/remember` (503 if Respire down)
- `POST /api/bots/:botId/memory`
- `PATCH /api/memory/:id`
- `DELETE /api/memory/:id`

### Tasks (schedules)

Implemented as `/api/tasks` (not `/api/schedules`). Body uses `ScheduleCreateRequest`: `{ botId, prompt, timeType, time }`.

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/toggle` `{ enabled }`

### Secrets

- `GET /api/secrets`
- `POST /api/secrets` `{ name, purpose, value, requestedBy?, scope? }`
- `POST /api/secrets/:name/approve`
- `POST /api/secrets/:name/revoke`
- `DELETE /api/secrets/:name`
- `GET /api/secrets/:name/value?botId=`

### Settings

Persisted in `{pi-bot-home}/settings.json`.

- `GET /api/settings` → `{ settings }`
- `PATCH /api/settings` → `{ settings }`

### Usage Stats

- `GET /api/usage?period=day|week|month` → `{ aggregations, stats }` where `stats.total.inputTokens` exists
- `GET /api/usage/stats` same GUI-friendly `stats` plus `aggregations`
- `GET /api/usage/records`
- `GET /api/usage/bots/:botId/stats`
- `POST /api/usage/cleanup`

### System

#### `GET /api/system/status`

Get system status.

**Response**: `SystemStatusResponse`

```json
{
  "version": "0.1.0",
  "uptime": 3600,
  "activeSessions": 3,
  "memoryBackend": "respire",
  "respireStatus": {
    "available": true,
    "version": "1.0.12",
    "mode": "normal"
  }
}
```

#### `GET /api/system/models`

List available models.

**Response**: `ListModelsResponse`

## Server-Sent Events (SSE)

### `GET /api/events`

Stream real-time events.

**Event types**:

- `message_update`: Bot message updates (streaming)
- `bot_status`: Bot status changes
- `question`: User questions from bots
- `system`: System notifications

**Example event**:

```
event: message_update
data: {"type":"message_update","botId":"bot-123","data":{"messageId":"msg-1","delta":"Hello"}}
```

## TypeScript Types

All request/response types are defined in `@pi-bot/shared` package.
Import from:

```typescript
import type {
  BotCreateRequest,
  CreateBotResponse,
  // ... etc
} from '@pi-bot/shared';
```

## Rate Limits

No rate limits in development mode.
Production: 100 req/min per IP (future).

## Error Codes

- `400`: Bad request (invalid input)
- `401`: Unauthorized
- `403`: Forbidden (permission denied)
- `404`: Not found
- `500`: Internal server error
