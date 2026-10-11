# Pi-Bot Web API Assumptions

This document describes the HTTP API endpoints and SSE events that the web UI assumes will be provided by the pi-bot daemon.

## Base URL

Default: `http://127.0.0.1:8787`

Configurable via environment variable: `VITE_API_BASE_URL`

## Authentication

The UI assumes the daemon only listens on localhost and uses no authentication for development. Production deployments should implement appropriate security measures.

## REST Endpoints

### Health Check

```
GET /api/health
Response: { status: "ok", version: string }
```

### Bot Management

```
GET /api/bots
Response: Bot[]

GET /api/bots/:id
Response: Bot

POST /api/bots
Body: CreateBotRequest
Response: Bot

PATCH /api/bots/:id
Body: UpdateBotRequest
Response: Bot

DELETE /api/bots/:id
Response: void
```

### Chat

```
GET /api/bots/:botId/messages?limit=50
Response: Message[]

POST /api/bots/:botId/messages
Body: { content: string, images?: string[] }
Response: void

GET /api/bots/:botId/stream (SSE)
Events: StreamEvent[]
```

### Groups

```
GET /api/groups
Response: Group[]

GET /api/groups/:id
Response: Group

POST /api/groups
Body: CreateGroupRequest
Response: Group

PATCH /api/groups/:id
Body: Partial<CreateGroupRequest>
Response: Group

DELETE /api/groups/:id
Response: void

GET /api/groups/:id/messages?limit=50
Response: Message[]

POST /api/groups/:id/messages
Body: { message: string }
Response: void
```

### Memory (Respire Integration)

```
GET /api/memory/search?query=...&scope=...&limit=20
Response: MemoryEntry[]

GET /api/memory/:id
Response: MemoryEntry

POST /api/bots/:botId/memory
Body: MemoryWriteRequest
Response: MemoryEntry

PATCH /api/memory/:id
Body: { content: string }
Response: MemoryEntry

DELETE /api/memory/:id
Response: void

GET /api/memory/summary?scope=team&botId=...
Response: { summary: string }
```

### Scheduled Tasks

```
GET /api/tasks
Response: ScheduledTask[]

GET /api/tasks/:id
Response: ScheduledTask

POST /api/tasks
Body: CreateScheduleRequest
Response: ScheduledTask

PATCH /api/tasks/:id
Body: Partial<CreateScheduleRequest>
Response: ScheduledTask

DELETE /api/tasks/:id
Response: void

POST /api/tasks/:id/toggle
Body: { enabled: boolean }
Response: ScheduledTask
```

### Secrets

```
GET /api/secrets
Response: Secret[]

POST /api/secrets
Body: RequestSecretRequest
Response: void

POST /api/secrets/:name/revoke
Body: { botId: string }
Response: void
```

### Usage Statistics

```
GET /api/usage?period=week&startDate=...
Response: UsageStats
```

### Models

```
GET /api/models
Response: ModelInfo[]
```

### Settings

```
GET /api/settings
Response: Settings

PATCH /api/settings
Body: Partial<Settings>
Response: Settings
```

## Server-Sent Events (SSE)

### Chat Stream

Event source: `GET /api/bots/:botId/stream`

Event format: `{ type: string, messageId?: string, content?: string, data?: any }`

Event types:
- `message_start` - New assistant message starting
- `text_delta` - Incremental text chunk (content field)
- `text_end` - Text generation complete
- `tool_start` - Tool execution starting
- `tool_end` - Tool execution complete
- `agent_settled` - Bot has finished responding
- `error` - Error occurred

## Error Responses

All endpoints return errors in the format:

```json
{
  "message": "Error description",
  "status": 400,
  "data": { /* optional additional context */ }
}
```

## Notes

1. All endpoints return JSON unless otherwise specified
2. Timestamps are ISO 8601 strings
3. IDs are strings (typically prefixed: `bot-`, `msg-`, `group-`, `task-`, `mem-`)
4. The SSE connection should be reestablished on disconnect
5. Mock implementation provides realistic delays to simulate network latency
