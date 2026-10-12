import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store/index.js';
import { SessionPool } from '../sessions/pool.js';
import { GroupManager } from '../groups/index.js';
import { createScheduler } from '../scheduler/index.js';
import { createSecretsManager } from '../secrets/index.js';
import { executePibotTool } from './tools.js';
import { MAX_HOPS, type PibotToolContext } from './types.js';
import { buildPibotSystemPrompt } from './prompt.js';
import type { BotConfig, ChatSessionSummary } from '#shared/index.js';
import type { Config } from '../config.js';

function testConfig(home: string): Config {
  return {
    host: { home, listen: '127.0.0.1:0', workspace: join(home, 'workspace'), maxSessions: 8, idleSeconds: 60 },
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

function bot(id: string, name: string, isMain = false): BotConfig {
  return {
    id,
    name,
    role: isMain ? 'chief' : 'worker',
    instructions: `${name} instructions`,
    model: { provider: 'faux', id: 'faux-1' },
    thinking: null,
    isMain,
    created: new Date().toISOString(),
    segments: [],
  };
}

describe('pibot tools (mock pool)', () => {
  let tmp: string;
  let ctx: PibotToolContext;
  let createdSessions: ChatSessionSummary[];
  let started: Array<{ botId: string; sessionId: string; message: string; hop?: number }>;
  let hopsSeen: number[];

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'pibot-tools-'));
    const store = new Store(testConfig(tmp));
    await store.load();
    const chief = await store.createBot({
      name: 'Chief',
      role: 'Main assistant',
      instructions: 'Lead the team',
      model: { provider: 'faux', id: 'faux-1' },
      isMain: true,
    });
    const researcher = await store.createBot({
      name: 'Researcher',
      role: 'research',
      instructions: 'Look things up',
      model: { provider: 'faux', id: 'faux-1' },
    });
    createdSessions = [];
    started = [];
    hopsSeen = [];
    const replies = new Map<string, string>([[`${researcher.id}:sess-1`, '今天晴，22度']]);

    const pool = {
      listBotSessions: async (target: BotConfig) =>
        createdSessions.filter((s) => s.id.startsWith(target.id) || true),
      createBotSession: async (target: BotConfig, name?: string) => {
        const summary: ChatSessionSummary = {
          id: `sess-${createdSessions.length + 1}`,
          name: name ?? target.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          model: target.model,
          thinking: null,
          isActive: true,
        };
        createdSessions.push(summary);
        return summary;
      },
      startChat: async (target: BotConfig, message: string, sessionId?: string, options?: { hop?: number }) => {
        hopsSeen.push(options?.hop ?? 0);
        const sid = sessionId ?? 'sess-active';
        started.push({ botId: target.id, sessionId: sid, message, hop: options?.hop });
        return { sessionId: sid, runId: 'run-1' };
      },
      waitForAssistant: async (target: BotConfig, sessionId: string) =>
        replies.get(`${target.id}:${sessionId}`) ?? 'ok',
      getLatestAssistantText: async (target: BotConfig, sessionId: string) =>
        replies.get(`${target.id}:${sessionId}`) ?? '',
      ensureActiveSessionId: async () => 'sess-1',
    };

    const scheduler = await createScheduler({
      storePath: join(tmp, 'schedules.json'),
      getDefaultTimezone: () => 'Asia/Shanghai',
      onTrigger: async () => {},
    });
    const secrets = await createSecretsManager({ storePath: join(tmp, 'secrets.json') });
    const groups = new GroupManager(store, pool as unknown as SessionPool);

    ctx = {
      store,
      pool: pool as unknown as SessionPool,
      scheduler,
      groups,
      secrets,
      getTimezone: () => 'Asia/Shanghai',
      currentBotId: chief.id,
      currentSessionId: 'chief-sess',
      currentHop: 0,
    };
    void researcher;
  });

  afterEach(async () => {
    await ctx.scheduler.shutdown();
    await rm(tmp, { recursive: true, force: true });
  });

  it('pibot_list_bots includes self and teammates', async () => {
    const result = await executePibotTool('pibot_list_bots', {}, ctx);
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain('Chief');
    expect(result.text).toContain('Researcher');
    expect(result.text).toContain('you');
  });

  it('pibot_create_bot creates a teammate (main only)', async () => {
    const ok = await executePibotTool(
      'pibot_create_bot',
      { name: 'Writer', role: 'edit', instructions: 'Write docs' },
      ctx
    );
    expect(ok.isError).toBeFalsy();
    expect(ok.text).toContain('Writer');
    const bots = await ctx.store.listBots();
    expect(bots.some((b) => b.name === 'Writer')).toBe(true);

    const worker = bots.find((b) => b.name === 'Researcher')!;
    const denied = await executePibotTool(
      'pibot_create_bot',
      { name: 'Nope', role: 'x', instructions: 'no' },
      { ...ctx, currentBotId: worker.id }
    );
    expect(denied.isError).toBe(true);
  });

  it('pibot_list_sessions and pibot_create_session with initialPrompt', async () => {
    const created = await executePibotTool(
      'pibot_create_session',
      { name: '天气调研', initialPrompt: '研究下今天天气' },
      ctx
    );
    expect(created.isError).toBeFalsy();
    expect(created.details).toMatchObject({ running: true });
    expect(String((created.details as { sessionId: string }).sessionId)).toBeTruthy();
    expect(started).toHaveLength(1);
    expect(started[0]!.message).toContain('天气');

    const listed = await executePibotTool('pibot_list_sessions', {}, ctx);
    expect(listed.text).toContain('天气调研');
  });

  it('pibot_get_session_result returns latest assistant text', async () => {
    const researcher = (await ctx.store.listBots()).find((b) => b.name === 'Researcher')!;
    const result = await executePibotTool(
      'pibot_get_session_result',
      { sessionId: 'sess-1', botId: researcher.id },
      ctx
    );
    expect(result.text).toContain('晴');
  });

  it('pibot_ask_bot waits for reply; hop limit blocks loops', async () => {
    const asked = await executePibotTool(
      'pibot_ask_bot',
      { bot: 'Researcher', message: '天气如何' },
      ctx
    );
    expect(asked.isError).toBeFalsy();
    expect(asked.text).toContain('晴');
    expect(hopsSeen[0]).toBe(1);

    const blocked = await executePibotTool(
      'pibot_ask_bot',
      { bot: 'Researcher', message: 'again' },
      { ...ctx, currentHop: MAX_HOPS }
    );
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toMatch(/跳数|hop/i);

    const sendBlocked = await executePibotTool(
      'pibot_send_to_session',
      { sessionId: 'sess-1', message: 'hi' },
      { ...ctx, currentHop: MAX_HOPS }
    );
    expect(sendBlocked.isError).toBe(true);
  });

  it('pibot_create_group and pibot_post_group', async () => {
    const researcher = (await ctx.store.listBots()).find((b) => b.name === 'Researcher')!;
    const group = await executePibotTool(
      'pibot_create_group',
      { name: 'Desk', members: [researcher.name] },
      ctx
    );
    expect(group.isError).toBeFalsy();
    expect(group.text).toContain('Desk');

    const groups = ctx.groups.listGroups();
    expect(groups.some((g) => g.name === 'Desk')).toBe(true);

    ctx.groups.postToGroup = async () => ({
      groupId: groups[0]!.id,
      replies: [{ botId: researcher.id, message: 'ack', passed: false }],
    });
    const posted = await executePibotTool(
      'pibot_post_group',
      { group: 'Desk', message: 'hello team' },
      ctx
    );
    expect(posted.isError).toBeFalsy();
    expect(posted.text).toContain('ack');
  });

  it('pibot_schedule_task uses settings timezone and stores name separately', async () => {
    const created = await executePibotTool(
      'pibot_schedule_task',
      { cron: '0 9 * * *', name: '晨报', message: '总结昨夜' },
      ctx
    );
    expect(created.isError).toBeFalsy();
    const tasks = await ctx.scheduler.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.timezone).toBe('Asia/Shanghai');
    expect(tasks[0]!.name).toBe('晨报');
    expect(tasks[0]!.prompt).toBe('总结昨夜');

    const listed = await executePibotTool('pibot_list_tasks', {}, ctx);
    expect(listed.text).toContain('晨报');
    expect(listed.text).toContain('Asia/Shanghai');
  });

  it('pibot_secret_list returns names only', async () => {
    await ctx.secrets.approveSecret(
      'OPENAI_KEY',
      { name: 'OPENAI_KEY', value: 'sk-secret', scope: 'all', purpose: 'test' },
      ctx.currentBotId
    );
    const result = await executePibotTool('pibot_secret_list', {}, ctx);
    expect(result.text).toContain('OPENAI_KEY');
    expect(result.text).not.toContain('sk-secret');
    expect((result.details as { names: string[] }).names).toEqual(['OPENAI_KEY']);
  });

  it('system prompt tells the bot when to create a research session', () => {
    const text = buildPibotSystemPrompt(bot('chief', 'Chief', true), [
      bot('chief', 'Chief', true),
      bot('r1', 'Researcher'),
    ]);
    expect(text).toContain('pi-bot');
    expect(text).toContain('pibot_create_session');
    expect(text).toContain('pibot_get_session_result');
    expect(text).toContain('Researcher');
  });
});
