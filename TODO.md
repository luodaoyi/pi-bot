# pi-bot Development TODO

## Current Status (Foundation Setup)

✅ **Completed:**
- Monorepo structure (pnpm workspaces)
- Basic package scaffolding:
  - `@pi-bot/shared` - Shared TypeScript types
  - `@pi-bot/respire-client` - Respire Runtime HTTP client
  - `pi-respire` - Pi extension for Respire integration
  - `pi-bot` - Main daemon
- Documentation:
  - README (English + Chinese)
  - LICENSE (Apache-2.0)
  - NOTICE
  - CONTRIBUTING.md
  - API documentation (`docs/api.md`)
- GitHub Actions:
  - CI workflow (Linux/macOS/Windows)
  - Release workflow (npm Trusted Publishing with OIDC)
- Configuration files:
  - TypeScript setup (strict mode, ESM)
  - ESLint + Prettier
  - Vitest

## ⚠️ Known Issues

### Type Errors
The codebase currently has TypeScript compilation errors because:
1. `@earendil-works/pi-coding-agent` is not yet installed (it needs to be published or we need access to the package)
2. The actual pi extension API may differ from documentation
3. Some implementation files need to match the real pi SDK signatures

### To Fix Before v0.1.0:

#### High Priority:
1. **Install pi dependencies** - Need access to `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai`
2. **Fix pi-respire types** - Update to match actual ExtensionAPI signatures:
   - `registerTool` parameters
   - Event object properties (`session_start`, `tool_call`, etc.)
   - Tool result format
3. **Fix pi-bot daemon**:
   - Remove Bun-specific code or add proper type guards
   - Complete `Store` implementation
   - Fix SSE implementation
4. **Write tests**:
   - Respire client tests (with mocked runtime)
   - Pi-respire extension tests (with mocked pi API)
   - Store tests

#### Medium Priority:
5. **Implement missing daemon features**:
   - Session pool manager
   - Group chat orchestration
   - Scheduler (cron support)
   - Secrets management (injection + masking)
   - Inter-bot messaging
   - Usage tracking
6. **Complete server routes**:
   - Groups API
   - Schedules API
   - Secrets API
   - Memory API
   - Usage stats API
7. **Add more comprehensive API documentation**

#### Low Priority:
8. **Enhance documentation**:
   - Architecture diagrams
   - Development guide
   - Deployment guide
9. **Add examples**:
   - Example bot configurations
   - Example integrations

## Implementation Notes

### Pi Extension API
The following needs verification against actual pi SDK:
- `registerTool()` signature and parameter types
- Event types: `SessionStartEvent`, `ToolCallEvent`, `AgentBeforeSettleEvent`
- Tool result format: should return `{ content: TextContent[], details?, isError? }`
- System prompt options structure

### Respire Integration
- Confirmed: HTTP RPC at `127.0.0.1:15169/api/rpc`
- Protocol version: `v=1`
- Methods: `cli.exec`, `runtime.status`, `runtime.result`
- MCP endpoint available at `/mcp` (alternative to HTTP RPC)

### Testing Strategy
1. Mock Respire runtime for unit tests
2. Mock pi API for extension tests  
3. Integration tests with real pi + mocked LLM
4. E2E tests with real Respire (optional, requires setup)

## Next Steps

1. **Get pi dependencies working**:
   ```bash
   # May need to wait for pi 1.1.0 to be published, or use git install
   pnpm add @earendil-works/pi-coding-agent @earendil-works/pi-ai
   ```

2. **Fix compilation errors**:
   - Start with `packages/pi-respire` 
   - Then `packages/pi-bot`

3. **Write basic tests**:
   - Respire client tests
   - Extension unit tests

4. **Manual testing**:
   ```bash
   # Terminal 1: Start Respire runtime (if available)
   rsrs --runtime-internal
   
   # Terminal 2: Build and run pi-bot
   pnpm build
   pnpm --filter pi-bot start
   ```

5. **Create PR** once CI passes

## Reference Documents

- Research documents in `/workspace/uploads/`:
  - `PLAN.md` - Overall implementation plan
  - `dsbot-features.md` - DeepSeek-Bot feature mapping
  - `respire.md` - Respire protocol details
  - `pi.md` - Pi extension API details

## Questions for Review

1. Should we support both HTTP RPC and MCP for Respire, or just HTTP RPC?
2. Do we need to support multiple memory backends (Respire + Markdown fallback)?
3. Should the daemon support both Node SDK and RPC modes for pi?
4. What's the priority for IM gateway support (Telegram, QQ, etc.)?
