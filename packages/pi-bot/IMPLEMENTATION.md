# Session, Team, and Groups Implementation

This implementation adds core multi-bot functionality to pi-bot, based on the DeepSeek-Bot design.

## Components Implemented

### 1. Session Pool (`packages/pi-bot/src/sessions/`)

Manages concurrent bot sessions using the pi SDK:

- **Lazy session creation**: Sessions are created on first message
- **Idle eviction**: Sessions are automatically destroyed after idle timeout
- **Concurrency limits**: Enforces max concurrent sessions (default 16)
- **Event streaming**: Forwards session events (message_start, message_update, message_end, etc.)
- **Automatic cleanup**: Graceful shutdown destroys all sessions

**API:**
- `getSession(bot)` - Get or create a session for a bot
- `sendMessage(botId, message, bot, options)` - Send message to bot
- `destroySession(botId)` - Manually destroy a session
- `getStats()` - Get pool statistics (active, idle, total)

### 2. Team Coordinator (`packages/pi-bot/src/team/`)

Implements bot-to-bot messaging and ask_user functionality:

- **message_bot**: Send messages between bots with sender tracking
- **Reply routing**: Routes replies back to sender or to user
- **Hop limit**: Prevents infinite message loops (max 6 hops)
- **ask_user**: Bots can ask questions that block until answered
- **Exchange tracking**: Records all inter-bot communication

**API:**
- `messageBot(request)` - Send message from one bot to another
- `askUser(request)` - Bot asks user a question
- `answerQuestion(request)` - User answers a pending question
- `listPendingQuestions()` - Get all unanswered questions
- `listExchanges(limit)` - Get recent inter-bot exchanges

### 3. Group Manager (`packages/pi-bot/src/groups/`)

Implements DS-Bot style group chat with turn-taking:

- **One-speaker-at-a-time**: Sequential turn-taking to control costs
- **Hidden sessions**: Each bot has separate session per group
- **Incremental context**: Members see messages since last turn
- **@mention addressing**: Direct next turn to specific member
- **[PASS] silence**: Members can skip their turn
- **Admin mode**: Restrict speaking to admin members only
- **Log management**: Maintains recent 60 messages per group

**API:**
- `createGroup(request)` - Create new group
- `updateGroup(id, request)` - Update group settings
- `deleteGroup(id)` - Delete group
- `postToGroup(request)` - Post message and run round
- `listGroups()` - List all groups

## HTTP Routes

### Bot Chat Routes (`/api/bots/:id/chat`)
- `POST /api/bots/:id/chat` - Send message and stream response
- `POST /api/bots/:id/abort` - Abort current response
- `GET /api/bots/:id/history` - Get chat history

### Team Routes (`/api/team/`)
- `POST /api/team/message` - Send message between bots
- `POST /api/team/ask` - Bot asks user a question
- `POST /api/team/answer` - User answers a question
- `GET /api/team/questions` - List pending questions
- `GET /api/team/exchanges` - List recent exchanges
- `GET /api/team/exchanges/:id` - Get specific exchange

### Group Routes (`/api/groups/`)
- `GET /api/groups` - List all groups
- `GET /api/groups/:id` - Get group details
- `POST /api/groups` - Create new group
- `PATCH /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/post` - Post message to group
- `GET /api/groups/:id/history` - Get group chat log

## Testing

Tests are provided for all major components:

- `sessions/pool.test.ts` - Session pool management
- `team/coordinator.test.ts` - Bot-to-bot messaging
- `groups/manager.test.ts` - Group chat functionality

Run tests with:
```bash
npm test
```

## Design Decisions

### Session Management
- Used pi SDK's `createAgentSession()` for concurrent sessions
- Each bot gets one persistent session, separate from group sessions
- Sessions use automatic persistence via SessionManager

### Group Sessions
- Each (group, member) pair gets a hidden session
- Hidden sessions are separate from bot's main chat session
- This isolates group context from direct chat context

### Turn-Taking
- Sequential speaking order: admins first, then other members
- @mention allows passing turn to specific member
- [PASS] allows skipping turn without adding to log
- Prevents concurrent rounds in same group

### Reply Routing
- Exchange records track message chains
- Replies can route back to sender ('me') or to user
- Hop counter prevents infinite loops

## Integration with Store

The implementation integrates with the existing Store:
- Uses `store.getBot()` to validate bot IDs
- Could be extended to persist groups in `state.json`
- Currently groups are in-memory (marked as TODO)

## Known Limitations

1. **Group persistence**: Groups are currently in-memory only
2. **History API**: Chat history endpoints are stubs (TODO)
3. **Abort functionality**: Abort endpoint is not fully implemented
4. **Concurrent SDK sessions**: Not yet verified if pi SDK supports true concurrency

## Next Steps

1. Add group persistence to Store
2. Implement chat history reading from session JSONL files
3. Add pi-bot extension for tools (message_bot, create_bot, ask_user)
4. Test with actual pi SDK installation
5. Add integration tests with real sessions
