# pi-bot HTTP API

**Base URL:** `http://127.0.0.1:8787`

All endpoints return JSON responses with the structure:

```typescript
{
  ok: boolean;
  data?: any;
  error?: string;
}
```

## Bots

### List Bots

```
GET /api/bots
```

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "Chief",
      "role": "Main bot and team coordinator",
      "instructions": "...",
      "model": "deepseek/deepseek-chat",
      "main": true,
      "created": 1234567890,
      "sessions": []
    }
  ]
}
```

### Create Bot

```
POST /api/bots
Content-Type: application/json

{
  "name": "string",
  "role": "string",
  "instructions": "string",
  "model": "string (optional)",
  "color": "string (optional)",
  "avatar": "string (optional)"
}
```

**Response:** `201 Created` with bot object

### Get Bot

```
GET /api/bots/:id
```

**Response:** Bot object or `404 Not Found`

### Update Bot

```
PUT /api/bots/:id
Content-Type: application/json

{
  "name": "string (optional)",
  "role": "string (optional)",
  "instructions": "string (optional)",
  "model": "string (optional)",
  ...
}
```

**Response:** Updated bot object or `404 Not Found`

### Delete Bot

```
DELETE /api/bots/:id
```

**Response:** `{ ok: true, data: { deleted: true } }` or `404 Not Found`

## Chat

### Send Message

```
POST /api/chat
Content-Type: application/json

{
  "botId": "string",
  "content": "string"
}
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "content": "Bot response text",
    "usage": {
      "input_tokens": 123,
      "output_tokens": 456,
      "cache_read_tokens": 0
    }
  }
}
```

**Errors:**
- `400` if missing `botId` or `content`
- `404` if bot not found
- `500` if execution fails

## Schedules

### List Schedules

```
GET /api/schedules
```

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "botId": "uuid",
      "name": "Daily standup",
      "cron": "0 9 * * 1-5",
      "prompt": "Give me a daily summary",
      "timezone": "UTC",
      "enabled": true,
      "created": 1234567890,
      "lastRun": 1234567890
    }
  ]
}
```

### Create Schedule

```
POST /api/schedules
Content-Type: application/json

{
  "botId": "string",
  "name": "string",
  "cron": "string",
  "prompt": "string",
  "timezone": "string (optional, default: UTC)",
  "enabled": "boolean (optional, default: true)"
}
```

**Cron Format:** Standard 5-field cron expression (`minute hour day month weekday`)

**Response:** `201 Created` with schedule object

**Errors:**
- `400` if invalid cron expression

### Update Schedule

```
PUT /api/schedules/:id
Content-Type: application/json

{
  "name": "string (optional)",
  "cron": "string (optional)",
  "prompt": "string (optional)",
  "enabled": "boolean (optional)",
  ...
}
```

**Response:** Updated schedule object or `404 Not Found`

### Delete Schedule

```
DELETE /api/schedules/:id
```

**Response:** `{ ok: true, data: { deleted: true } }` or `404 Not Found`

## Secrets

**Note:** Secret values are never returned by the API. Only keys and metadata are exposed.

### List Secrets

```
GET /api/secrets
```

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "key": "GITHUB_TOKEN",
      "description": "GitHub API token",
      "created": 1234567890
    }
  ]
}
```

### Create Secret

```
POST /api/secrets
Content-Type: application/json

{
  "key": "string",
  "value": "string",
  "description": "string (optional)"
}
```

**Response:** `201 Created` with `{ ok: true, data: { key, created: true } }`

**Note:** Secrets are injected into bot sessions as environment variables: `PIBOT_SECRET_<KEY>` (uppercase)

### Delete Secret

```
DELETE /api/secrets/:key
```

**Response:** `{ ok: true, data: { deleted: true } }` or `404 Not Found`

## Usage

### Query Usage Records

```
GET /api/usage?botId=<id>&model=<model>&since=<timestamp>&until=<timestamp>&limit=<n>
```

**Query Parameters:** (all optional)
- `botId`: Filter by bot ID
- `model`: Filter by model name
- `since`: Unix timestamp (ms) - records after this time
- `until`: Unix timestamp (ms) - records before this time
- `limit`: Maximum number of records to return

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "botId": "uuid",
      "botName": "Chief",
      "timestamp": 1234567890,
      "model": "deepseek/deepseek-chat",
      "inputTokens": 123,
      "outputTokens": 456,
      "totalTokens": 579,
      "costUsd": 0.0001,
      "cachedTokens": 0,
      "latencyMs": 1234
    }
  ]
}
```

### Get Usage Statistics

```
GET /api/usage/stats?botId=<id>&model=<model>&since=<timestamp>&until=<timestamp>
```

**Query Parameters:** Same as query endpoint (except `limit`)

**Response:**

```json
{
  "ok": true,
  "data": {
    "totalMessages": 100,
    "totalInputTokens": 12345,
    "totalOutputTokens": 45678,
    "totalTokens": 58023,
    "totalCostUsd": 0.01,
    "avgLatencyMs": 1234,
    "byModel": {
      "deepseek/deepseek-chat": {
        "messages": 100,
        "tokens": 58023,
        "cost": 0.01
      }
    }
  }
}
```

## Types Reference

### Bot

```typescript
interface Bot {
  id: string;
  name: string;
  role: string;
  instructions: string;
  model: string;
  color?: string;
  avatar?: string;
  main: boolean;
  created: number;
  sessions: string[];
}
```

### Schedule

```typescript
interface Schedule {
  id: string;
  botId: string;
  name: string;
  cron: string;
  prompt: string;
  timezone: string;
  enabled: boolean;
  created: number;
  lastRun?: number;
}
```

### Message (Internal)

```typescript
interface Message {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  content: string;
  timestamp: number;
  hops: number;
  expectReply?: boolean;
  replyTo?: string;
}
```

### UsageRecord

```typescript
interface UsageRecord {
  id?: number;
  botId: string;
  botName?: string;
  messageId?: string;
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  cachedTokens?: number;
  latencyMs?: number;
  metadata?: any;
}
```

## Authentication

Currently, the API has no authentication. It is designed to run on `127.0.0.1` and be accessed only locally or via a trusted Web UI.

Future versions may add token-based authentication.

## Rate Limiting

No rate limiting is currently enforced. The daemon manages bot session pools to prevent resource exhaustion.

## Error Codes

- `400 Bad Request` - Invalid input (e.g., malformed JSON, missing required fields)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Execution failure

All error responses include an `error` field with a human-readable message.
