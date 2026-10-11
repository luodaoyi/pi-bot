/**
 * Session pool + SDK faux provider: streaming order, abort, sessions CRUD.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createAgentSessionServices,
  ModelRuntime,
} from '@earendil-works/pi-coding-agent';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxThinking,
} from '@earendil-works/pi-ai';
import type { BotConfig } from '#shared/index.js';
import type { BotSseEvent } from '#shared/index.js';
import { SessionPool } from './pool.js';
import { resetSharedAgentServices } from './services.js';

async function createFauxServices(cwd: string, agentDir: string, faux: ReturnType<typeof fauxProvider>) {
  const runtime = await ModelRuntime.create({
    authPath: join(agentDir, 'auth.json'),
    modelsPath: null,
    refreshOnCreate: false,
  });
  runtime.registerNativeProvider(faux.provider);
  try {
    await runtime.setRuntimeApiKey(faux.provider.id, 'test-key');
  } catch {
    // Some faux providers have no apiKey login; resolution tests still cover fallbacks.
  }

  return createAgentSessionServices({
    cwd,
    agentDir,
    modelRuntime: runtime,
    resourceLoaderOptions: {
      noExtensions: true,
      noContextFiles: true,
    },
  });
}

function testBot(id = 'bot-sdk'): BotConfig {
  return {
    id,
    name: 'SDK Bot',
    role: 'tester',
    instructions: 'test',
    model: { provider: 'faux', id: 'faux-1' },
    thinking: null,
    isMain: false,
    created: new Date().toISOString(),
    segments: [],
  };
}

describe('SessionPool with SDK faux provider', () => {
  let tmp: string;
  let pool: SessionPool;
  let faux: ReturnType<typeof fauxProvider>;

  beforeEach(async () => {
    resetSharedAgentServices();
    tmp = await mkdtemp(join(tmpdir(), 'pi-bot-sdk-'));
    faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-1', name: 'Faux One' }],
      tokensPerSecond: 40,
    });
    const cwd = join(tmp, 'workspace');
    const agentDir = join(tmp, 'agent');
    const services = await createFauxServices(cwd, agentDir, faux);
    pool = new SessionPool({
      maxSessions: 4,
      idleTimeoutMs: 30_000,
      sessionDir: join(tmp, 'sessions'),
      workspaceDir: cwd,
      services,
      loadUserExtensions: false,
      loadContextFiles: false,
    });
  });

  afterEach(async () => {
    await pool.destroy();
    await rm(tmp, { recursive: true, force: true });
    resetSharedAgentServices();
  });

  it('lists/creates/gets/patches/deletes sessions', async () => {
    const bot = testBot();
    const created = await pool.createBotSession(bot, 'Alpha');
    expect(created.name).toBe('Alpha');

    const listed = await pool.listBotSessions(bot);
    expect(listed.some((s) => s.id === created.id)).toBe(true);

    const detail = await pool.getBotSession(bot, created.id);
    expect(detail.session.id).toBe(created.id);
    expect(detail.messages).toEqual([]);
    expect(detail.stats.tokens.total).toBe(0);

    const patched = await pool.patchBotSession(bot, created.id, { name: 'Renamed' });
    expect(patched.name).toBe('Renamed');

    const second = await pool.createBotSession(bot, 'Beta');
    await pool.activateBotSession(bot, created.id);
    const afterActivate = await pool.listBotSessions(bot);
    expect(afterActivate.find((s) => s.id === created.id)?.isActive).toBe(true);
    expect(afterActivate.find((s) => s.id === second.id)?.isActive).toBe(false);

    await pool.deleteBotSession(bot, second.id);
    const afterDelete = await pool.listBotSessions(bot);
    expect(afterDelete.map((s) => s.id)).not.toContain(second.id);

    await expect(pool.forkBotSession(bot, created.id, 'missing-entry')).rejects.toThrow(
      /no persisted file/
    );
  });

  it('streams events in contract order: start → thinking → text → end → turn → stats', { timeout: 20_000 }, async () => {
    const bot = testBot();
    faux.setResponses([
      fauxAssistantMessage([
        fauxThinking('considering'),
        fauxText('hello from faux'),
      ]),
    ]);

    const events: string[] = [];
    pool.on('bot_event', (payload: { event: BotSseEvent }) => {
      events.push(payload.event.type);
    });

    const accepted = await pool.startChat(bot, 'hi');
    expect(accepted.sessionId).toBeTruthy();

    await viWaitFor(() => events.includes('bot.turn_end') && events.includes('bot.stats'), 15_000);

    // User message_start/end come first; assert assistant turn order after the last start.
    const assistantStart = events.lastIndexOf('bot.message_start');
    const slice = events.slice(assistantStart);
    const order = ['bot.message_start', 'bot.text_delta', 'bot.message_end', 'bot.turn_end', 'bot.stats'];
    let cursor = -1;
    for (const type of order) {
      const next = slice.indexOf(type, cursor + 1);
      expect(next, `${type} after ${order[Math.max(cursor, 0)]} in ${slice.join(',')}`).toBeGreaterThan(cursor);
      cursor = next;
    }
    const thinking = slice.indexOf('bot.thinking_delta');
    if (thinking >= 0) {
      expect(thinking).toBeGreaterThan(slice.indexOf('bot.message_start'));
      expect(thinking).toBeLessThan(slice.indexOf('bot.message_end'));
    }
  });

  it('abort stops an in-flight prompt', { timeout: 20_000 }, async () => {
    const bot = testBot();
    faux.setResponses([
      fauxAssistantMessage('a long streamed reply that we will abort before completion '.repeat(40)),
    ]);

    const events: BotSseEvent[] = [];
    pool.on('bot_event', (payload: { event: BotSseEvent }) => {
      events.push(payload.event);
    });

    const accepted = await pool.startChat(bot, 'slow please');
    await viWaitFor(() => events.some((e) => e.type === 'bot.message_start'), 10_000);
    const aborted = await pool.abort(bot.id, accepted.sessionId);
    expect(aborted).toBe(true);

    await viWaitFor(
      () => events.some((e) => e.type === 'bot.turn_end' || e.type === 'bot.error'),
      10_000
    );
  });
});

async function viWaitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
