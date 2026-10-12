/**
 * create_session + initialPrompt + get_session_result 走真实 SessionPool + faux provider
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentSessionServices, ModelRuntime } from '@earendil-works/pi-coding-agent';
import { fauxAssistantMessage, fauxProvider, fauxText } from '@earendil-works/pi-ai';
import { SessionPool } from '../sessions/pool.js';
import { resetSharedAgentServices } from '../sessions/services.js';
import { Store } from '../store/index.js';
import { GroupManager } from '../groups/index.js';
import { createScheduler } from '../scheduler/index.js';
import { createSecretsManager } from '../secrets/index.js';
import { executePibotTool } from './tools.js';
import { MAX_HOPS, type PibotToolContext } from './types.js';
import type { Config } from '../config.js';

function testConfig(home: string): Config {
  return {
    host: { home, listen: '127.0.0.1:0', workspace: join(home, 'workspace'), maxSessions: 8, idleSeconds: 30 },
    pi: { minVersion: '1.1.0', loadUserExtensions: false, loadContextFiles: false, defaultModel: '' },
    memory: { backend: 'off', review: false },
    respire: {
      port: 15169,
      autostart: false,
      policy: 'lite',
      reanchorTokens: 1000,
      gate: {
        firstTool: 'off',
        strictBatch: false,
        errorGate: 'off',
        settleRecall: 'off',
        settleStore: 'off',
        forceToolChoice: false,
        maxBlocks: 1,
      },
      scope: { teamProject: '', botProjectPrefix: 'pi-bot/' },
    },
  };
}

describe('pibot create_session roundtrip (faux)', () => {
  let tmp: string;
  let pool: SessionPool;
  let ctx: PibotToolContext;
  let faux: ReturnType<typeof fauxProvider>;

  beforeEach(async () => {
    resetSharedAgentServices();
    tmp = await mkdtemp(join(tmpdir(), 'pibot-roundtrip-'));
    faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-1', name: 'Faux One' }],
      tokensPerSecond: 80,
    });
    const cwd = join(tmp, 'workspace');
    const agentDir = join(tmp, 'agent');
    const runtime = await ModelRuntime.create({
      authPath: join(agentDir, 'auth.json'),
      modelsPath: null,
      refreshOnCreate: false,
    });
    runtime.registerNativeProvider(faux.provider);
    try {
      await runtime.setRuntimeApiKey(faux.provider.id, 'test-key');
    } catch {
      // ignore
    }
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      modelRuntime: runtime,
      resourceLoaderOptions: { noExtensions: true, noContextFiles: true },
    });
    pool = new SessionPool({
      maxSessions: 6,
      idleTimeoutMs: 30_000,
      sessionDir: join(tmp, 'sessions'),
      workspaceDir: cwd,
      services,
      loadUserExtensions: false,
      loadContextFiles: false,
    });

    const store = new Store(testConfig(tmp));
    await store.load();
    const chief = await store.createBot({
      name: 'Chief',
      role: 'main',
      instructions: 'lead',
      model: { provider: 'faux', id: 'faux-1' },
      isMain: true,
    });
    await store.createBot({
      name: 'Researcher',
      role: 'research',
      instructions: 'research',
      model: { provider: 'faux', id: 'faux-1' },
    });
    const scheduler = await createScheduler({
      storePath: join(tmp, 'schedules.json'),
      getDefaultTimezone: () => 'Asia/Shanghai',
      onTrigger: async () => {},
    });
    const secrets = await createSecretsManager({ storePath: join(tmp, 'secrets.json') });
    const groups = new GroupManager(store, pool);
    pool.setHost({
      store,
      pool,
      scheduler,
      groups,
      secrets,
      getTimezone: () => 'Asia/Shanghai',
    });
    ctx = {
      store,
      pool,
      scheduler,
      groups,
      secrets,
      getTimezone: () => 'Asia/Shanghai',
      currentBotId: chief.id,
      currentSessionId: 'unused',
      currentHop: 0,
    };
  });

  afterEach(async () => {
    await pool.destroy();
    await ctx.scheduler.shutdown();
    for (let i = 0; i < 8; i++) {
      try {
        await rm(tmp, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 40 * (i + 1)));
      }
    }
    resetSharedAgentServices();
  });

  it('create_session + initialPrompt + get_session_result', { timeout: 25_000 }, async () => {
    faux.setResponses([fauxAssistantMessage([fauxText('今日晴朗，22°C')])]);
    const created = await executePibotTool(
      'pibot_create_session',
      { botId: 'Researcher', name: '天气', initialPrompt: '今天天气怎么样' },
      ctx
    );
    expect(created.isError).toBeFalsy();
    const sessionId = (created.details as { sessionId: string }).sessionId;
    expect(sessionId).toBeTruthy();

    const result = await executePibotTool(
      'pibot_get_session_result',
      { sessionId, botId: 'Researcher', waitMs: 15_000 },
      ctx
    );
    expect(result.isError).toBeFalsy();
    expect(result.text).toMatch(/晴|22/);

    const researcher = (await ctx.store.listBots()).find((b) => b.name === 'Researcher')!;
    const listed = await pool.listBotSessions(researcher);
    const row = listed.find((s) => s.id === sessionId);
    expect(row?.messageCount).toBeGreaterThan(0);
    expect(row?.name).toBe('天气');
  });

  it('hop limit is enforced before another ask', async () => {
    const blocked = await executePibotTool(
      'pibot_ask_bot',
      { bot: 'Researcher', message: 'ping' },
      { ...ctx, currentHop: MAX_HOPS }
    );
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toMatch(/跳数|hop/i);
  });
});
