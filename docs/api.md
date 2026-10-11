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

### Memory

#### `GET /api/memory/status`

Get memory system status.

**Response**: `MemoryStatusResponse`

#### `POST /api/memory/recall`

Recall memories.

**Request**: `RecallRequest`

**Response**: `RecallResponse`

#### `POST /api/memory/remember`

Store a memory.

**Request**: `RememberRequest`

**Response**: `RememberResponse`

#### `DELETE /api/memory/:id`

Forget a memory.

**Request**: `ForgetRequest`

**Response**: `ForgetResponse`

### Schedules

#### `GET /api/schedules`

List schedules.

**Response**: `ListSchedulesResponse`

#### `POST /api/schedules`

Create a schedule.

**Request**: `CreateScheduleRequest`

**Response**: `CreateScheduleResponse`

#### `DELETE /api/schedules/:id`

Delete a schedule.

**Response**: `DeleteScheduleResponse`

### Secrets

#### `GET /api/secrets`

List secrets (values not included).

**Response**: `ListSecretsResponse`

#### `POST /api/secrets`

Create a secret.

**Request**: `SecretCreateRequest`

**Response**: `CreateSecretResponse`

#### `DELETE /api/secrets/:name`

Delete a secret.

**Response**: `DeleteSecretResponse`

### Usage Stats

#### `GET /api/usage`

Get usage statistics.

**Query params**:
- `from`: ISO date (optional)
- `to`: ISO date (optional)
- `botId`: Filter by bot (optional)

**Response**: `GetUsageStatsResponse`

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
