# pi-bot Architecture

## Overview

pi-bot is a multi-bot team system built on the pi coding agent, with Respire providing unified memory. The architecture consists of three main layers:

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interfaces                       │
│              (Web UI, TUI, IM Gateways)                     │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP/SSE/RPC
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      pi-bot Daemon                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Orchestrator (roster, delivery, groups, scheduler)   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Session Pool (AgentSession × N via pi SDK)          │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Each session loads inline extensions:                │  │
│  │  • pi-respire (Boot, recall gate, memory tools)     │  │
│  │  • team (message_bot, create_bot, permissions)      │  │
│  │  • context (steward, secrets masking, images)       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    │                          │
           ┌────────┴────────┐        ┌────────┴─────────┐
           ▼                 ▼        ▼                  ▼
    ┌─────────────┐   ┌──────────────────┐      ┌─────────────┐
    │  Respire    │   │   pi SDK         │      │  LLM        │
    │  Runtime    │   │   (sessions,     │      │  Providers  │
    │  (rsrs)     │   │    models)       │      │  (DeepSeek) │
    └─────────────┘   └──────────────────┘      └─────────────┘
         HTTP                                          
      127.0.0.1:15169                                  
```

## Components

### 1. respire-client

A TypeScript client for the Respire Runtime RPC protocol.

**Key Files:**
- `client.ts`: HTTP client for `/api/rpc` and `/api/health`
- `envelope.ts`: ResultEnvelope types and parsing
- `argv.ts`: Tool parameters → CLI argv mapping (aligned with respire MCP)

**Protocol:**
- Endpoint: `POST http://127.0.0.1:15169/api/rpc`
- Envelope: `{v:1, id, method, args, queue_wait_ms}`
- Response: `{v:1, id, ok, exit, bin, envelope, error, code}`

**Key Methods:**
- `health()`: Check runtime status
- `exec(argv)`: Execute `cli.exec` with `--json` args
- `recall(query, opts)`: Semantic memory recall
- `remember(content, opts)`: Store memory with judge-then-store
- `show(id)`: Retrieve full memory entry

### 2. pi-respire

A pi extension (also publishable as standalone pi package) that integrates Respire memory.

**Entry Point:** `src/index.ts` exports `default (pi: ExtensionAPI) => respireExtension(opts)(pi)`

**Core Modules:**
- `boot.ts`: `session_start` hook
  - Health check Respire runtime
  - Read `agent-config` (memory_off/readonly mode)
  - Fetch `prompt` (full policy text)
  - Cache by `bin` version
  
- `inject.ts`: `before_agent_start` hook
  - Inject `<respire_policy>` section into system prompt
  - Mode-specific content (normal/readonly/off/unavailable)
  - Byte-stable for prompt caching
  
- `gate.ts`: Recall gate state machine
  - **L1**: Policy in system prompt + tool `promptGuidelines`
  - **L2**: `tool_call` hook blocks non-recall first calls
  - **L3**: `agent_before_settle` reminder if no recall happened
  - **L4** (optional): `before_provider_request` forces `tool_choice`
  - States: CLOSED → PENDING → OPEN → ERROR_GATE
  
- `tools.ts`: Memory tools via `registerTool`
  - `respire_recall / show / list / diary / tree / history / ...`
  - `respire_remember / update / attach / forget / restore`
  - Parameters aligned with Respire MCP schema
  - Scope enforcement via `tool_call` hook
  
- `commands.ts`: Slash commands
  - `/respire status | mode | reload`

**Configuration:**
```toml
[respire]
port = 15169
autostart = true
policy = "full"  # full | lite
reanchor_tokens = 60000

[respire.gate]
first_tool = "block"  # block | warn | off
strict_batch = true
error_gate = "block"
settle_recall = "continue"
settle_store = "warn"
force_tool_choice = false
max_blocks = 3

[respire.scope]
team_project = ""
bot_project_prefix = "pi-bot/"
```

### 3. pi-bot

The daemon host that manages multiple bot sessions.

**CLI:**
- `pi-bot serve`: Start daemon with HTTP API
- `pi-bot init`: Initialize config and home directory
- `pi-bot doctor`: Diagnose setup

**Key Modules:**

#### Core
- `cli.ts`: Command-line interface
- `config.ts`: Config loading (TOML + env vars, zod validation)
- `home.ts`: Home directory layout, single-writer lock
- `store.ts`: `state.json` atomic writes with migrations
- `pool.ts`: Session pool (create, LRU, dispose, reopen)

#### Team
- `team/roster.ts`: Bot CRUD, bootstrap Chief
- `team/delivery.ts`: `message_bot` routing with hop limit
- `team/turns.ts`: Reply routing
- `team/groups.ts`: Group chat (turn-taking, @mention, PASS)
- `team/questions.ts`: `ask_user` cards
- `team/permissions.ts`: Main bot / admin matrix
- `team-extension.ts`: Inline extension factory
  - Registers team tools (create_bot, message_bot, etc.)
  - Injects `<bot_identity>` section

#### Context
- `context/parts.ts`: Part/checkpoint management
- `context/steward.ts`: Context steward (compaction decision)
- `context/chat-index.ts`: SQLite FTS5 trigram index
- `context-extension.ts`: Inline extension factory
  - Compaction hooks
  - Secrets masking
  - Image → text conversion

#### Services
- `secrets.ts`: Secrets store (0600 JSON), masking
- `schedules.ts`: Cron scheduler with persistence
- `usage.ts`: Usage stats (SQLite, `message_end` hook)
- `images.ts`: Vision model for image → text
- `connectors.ts`: MCP (GitHub, etc.)
- `web-tools.ts`: `web_search` / `web_fetch`

#### API Server
- `server/api.ts`: HTTP routes
- `server/sse.ts`: Server-Sent Events for streaming
- `server/static.ts`: Serve Web UI assets

**Data Directory** (`~/.pi-bot/`):
```
state.json         # roster, groups, questions, schedules
state.lock         # single-writer lock
secrets.json       # encrypted secrets (0600)
usage.sqlite       # usage statistics
chat-index.sqlite  # FTS5 index
```

**HTTP API** (see `docs/api.md`):
- `GET /api/bots` → List bots
- `POST /api/bots` → Create bot
- `GET /api/bots/:id` → Bot details
- `POST /api/bots/:id/message` → Send message
- `GET /api/bots/:id/stream` → SSE stream
- `POST /api/groups` → Create group
- `GET /api/groups/:id` → Group details
- `POST /api/groups/:id/post` → Post to group
- `GET /api/schedules` → List schedules
- `POST /api/schedules` → Create schedule
- `GET /api/secrets` → List secrets
- `POST /api/secrets` → Store secret
- `GET /api/usage` → Usage statistics

### 4. protocol

Shared TypeScript types for the HTTP API, consumed by the Web UI agent.

## Design Decisions

### 1. Pure TypeScript
- **Why**: pi extensions are TS/JS only; pi SDK is Node-native
- **Alternatives considered**: Python sidecar (rejected: IPC overhead, complexity)

### 2. One Global Respire Memory
- **Why**: Simplicity; Respire handles semantic search, structure, encryption
- **No**: Per-bot isolation, permissions, DS-Bot's Markdown memory/auto-review
- **Scope convention**: `pi-bot/<botId>` parent nodes, `pi-bot/team` for shared

### 3. Model-Driven Recall (D2)
- **Why**: Respire's "first tool recall" rule is part of its published behavior
- **Host does NOT**: Pre-recall on behalf of model, pre-fill memories
- **Host DOES**: Inject rules, enforce gate via hooks, provide tools

### 4. In-Process Multi-Session
- **Why**: Lower latency, shared resources
- **Fallback**: `pi --mode rpc` subprocesses if unstable (verify in M0 PoC)

### 5. Extension-Based Architecture
- **Each bot session** loads inline extension factories:
  1. `respireExtension({ client, scope, mode })`
  2. `teamExtension({ orch, botId })`
  3. `contextExtension({ steward, secrets, images })`
  4. (optional) `createMcpExtension()` if connectors enabled
- **Order matters**: Respire gate must be first (to block before other tools)

## Milestones

### M0: PoC (verification)
- [x] SDK multi-session: two `AgentSession` in one process
- [x] Boot injection: 40KB policy → system prompt, verify prompt caching
- [x] Recall gate: mock LLM sequences, verify block/reset logic
- [x] RespireClient: health, exec, recall, show, remember (mock runtime)
- [x] SQLite FTS5 library choice
- [ ] Report findings

### M1: Skeleton + pi-respire (2 weeks)
- [ ] `pi install ./packages/pi-respire` works in pi TUI
- [ ] System prompt contains policy
- [ ] First non-recall tool is blocked
- [ ] `/respire status` shows mode correctly
- [ ] `off` mode allows all tools
- [ ] Runtime unavailable → model says "recall failed" in first line
- [ ] Daemon: `pi-bot serve` starts, bootstrap Chief, Web chat streams
- [ ] Restart resumes conversation
- [ ] Single-writer lock works

### M2: Team (2 weeks)
- [ ] Main bot creates Writer via tool
- [ ] Writer receives `message_bot` → recalls → replies
- [ ] Normal bot calling `create_bot` is blocked
- [ ] Hop limit prevents loops

### M3: Group Chat + Long Context (2-3 weeks)
- [ ] 3-bot group: @ relay and [PASS] work correctly
- [ ] Steward triggers both branches (checkpoint / new part)
- [ ] New part recalls handoff note from previous part
- [ ] Error gate, settle reminders, long context re-anchor all work per config
- [ ] Web search is functional

### M4: Operations (2 weeks)
- [ ] Scheduled tasks survive restart, fire on time
- [ ] Tasks also trigger recall first
- [ ] Secret values absent from: model requests, logs, session files, Respire writes
- [ ] Memory panel works
- [ ] Usage stats correct

### M5: Polish (2 weeks)
- [ ] Image → text
- [ ] GitHub connector
- [ ] Chinese + English UI

### M6: v1.0
- [ ] npm publish `pi-bot`, `pi-respire`
- [ ] Compatibility matrix (pi × rsrs × OS)
- [ ] Optional IM gateway / browser tools

## Testing Strategy

### Unit Tests (vitest)
- Argv mapping (each against mcp.rs)
- Envelope parsing
- **Recall gate state machine** (first call blocked, strict batch, nested calls, steer reset, error gate, max_blocks, off mode bypass)
- @ parsing
- Schedule calculations
- Secrets masking
- Permissions matrix

### Injection Assertions (contract tests)
- Injected section MUST contain verbatim policy text fetched from runtime (hash comparison)
- Appendix MUST NOT contain weakening phrases like "可以跳过" or "无需 recall"
- `off` mode MUST NOT contain policy

### Contract: Respire
- Real `rsrs` + temp `RSRS_DATA_DIR` + custom `RSRS_RPC_PORT`
- Health, agent-config, prompt, recall (empty → skip), show, remember (returns candidates), update, forget, runtime.result, runtime stop
- TypeBox schema field-level comparison against `/mcp tools/list`

### Contract: pi
- Pinned SDK version + scripted mock LLM (OpenAI-compatible, via `models.json`)
- Mock sends "read + recall" → blocked, then "recall" → allowed
- Pure text answer triggers settle continuation
- After compaction, section still present
- Prompt cache hit (check usage cacheRead)

### End-to-End (Playwright + script)
- Bootstrap Chief → create Bot → private chat (first call recall) → group chat @ relay → scheduled task → steward switches part → new part model recalls previous part's memory

### Real Model Behavior (manual, not in CI)
- DeepSeek, Claude, GPT: 20 rounds each
- Statistics: % of first-call-is-recall, % of blocked-then-corrects
- Used for L1/L2 effectiveness data

### CI (GitHub Actions)
- Linux / macOS / Windows: lint, typecheck, test

## Risks

- **R1**: pi SDK API instability (rapid iteration, package rename)
- **R2**: Single-process exceptions affecting all bots
- **R3**: Respire RPC coupling to CLI argv (no typed API)
- **R4**: Policy size ~40KB per bot (rely on prompt caching)
- **R5**: Respire loopback auth-free: bot with bash can bypass scope via direct `curl`
- **R6**: Gate false positives causing retry loops
- **R7**: Pure text answers bypass L2 (mitigated by L3/L4)
- **R8**: "Excessive" strictness: even small talk requires recall first
- **R9**: Duplicate injection with existing `rsrs inject --id pi`
- **R10**: Licensing: Respire is Noncommercial
- **R11**: Windows Git Bash path issues (pi#2080, memocap precedent)

## References

- [pi docs](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/docs)
- [Respire docs](https://github.com/risense-ai/respire-cli/tree/main/docs)
- [DeepSeek-Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot)
- [memocap](https://github.com/luodaoyi/memocap) (injection precedent)
