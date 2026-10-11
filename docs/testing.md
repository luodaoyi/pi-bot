# Testing

pi-bot uses [Vitest](https://vitest.dev/) for testing.

## Running Tests

```bash
npm test
```

## Test Coverage

- **121 total tests** (108 running, 13 skipped)
- **11 test files** pass, 2 are skipped due to Vitest limitations

## Skipped Tests

### node:sqlite Tests (12 tests skipped)

Tests in `src/daemon/usage/index.test.ts` (8 tests) and `src/daemon/extensions/index.test.ts` (4 tests) are currently skipped in Vitest due to a limitation with how Vitest handles Node.js built-in modules with the `node:` protocol.

**Why skipped:**
- These tests import `node:sqlite` (Node.js built-in SQLite, available since Node 22.5)
- Vitest's test runner has issues loading `node:` protocol imports in its test environment
- The code works correctly in production and in CI E2E tests

**CI Validation:**
- CI includes E2E tests that verify SQLite functionality works correctly in the packaged build
- The daemon starts successfully and usage tracking works as expected
- See `.github/workflows/ci.yml` "E2E Smoke Test" step

**Manual Testing:**
To manually test the UsageTracker outside of Vitest:

```bash
# Build the project
npm run build

# Create a test script
cat > /tmp/test-usage.mjs << 'EOF'
import { createUsageTracker } from './dist/daemon/usage/index.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = await mkdtemp(join(tmpdir(), 'pi-bot-test-'));
const tracker = createUsageTracker({ homeDir: tempDir });
await tracker.init();

await tracker.record({
  botId: 'test-bot',
  sessionId: 'test-session',
  model: { provider: 'test', modelId: 'test-model' },
  inputTokens: 100,
  outputTokens: 50,
});

const stats = await tracker.getStats();
console.log('Stats:', stats);

await tracker.close();
console.log('✓ UsageTracker works correctly');
EOF

# Run the test
node /tmp/test-usage.mjs
```

### Integration Test (1 test skipped)

The test `src/respire-extension/test/integration.test.ts > should run a full session with faux provider` is manually skipped (using `it.skip`) because it requires complex Pi SDK session setup with a faux provider that isn't implemented yet.

## Test Environment

### Node Environment (Default)
Most tests run in Node.js environment:
- Daemon tests
- Respire client/extension tests  
- Utility tests

### jsdom Environment (Web Tests)
Web GUI tests run in jsdom environment:
- `web/src/**/*.test.ts` files use jsdom for DOM testing
- Configured via `environmentMatchGlobs` in `vitest.config.ts`

## Test Organization

```
src/
├── daemon/
│   ├── usage/index.test.ts          # ⚠️ Skipped (node:sqlite issue)
│   ├── extensions/index.test.ts     # ⚠️ Skipped (node:sqlite issue)
│   ├── sessions/pool.test.ts        # ✓ Running
│   ├── scheduler/index.test.ts      # ✓ Running
│   ├── secrets/index.test.ts        # ✓ Running
│   ├── groups/manager.test.ts       # ✓ Running
│   ├── team/coordinator.test.ts     # ✓ Running
│   └── test/store.test.ts           # ✓ Running
├── respire-client/
│   └── client.test.ts               # ✓ Running
├── respire-extension/
│   └── test/
│       ├── runtime-mock.test.ts     # ✓ Running
│       ├── gate.test.ts             # ✓ Running
│       └── integration.test.ts      # ⚠️ 1 skipped (manual)
web/
└── src/
    └── api/__tests__/
        └── mock.test.ts             # ✓ Running (jsdom)
```

## CI Testing

CI includes comprehensive testing across Ubuntu, macOS, and Windows:

1. **Unit & Integration Tests**: `npm test`
2. **Type Checking**: `npm run typecheck`  
3. **Linting**: `npm run lint`
4. **Package Verification**: Install tarball via `pi install`
5. **E2E Smoke Tests**: Start daemon, test HTTP API, verify GUI loads

See [CI workflow](.github/workflows/ci.yml) for complete test matrix.
