/**
 * 合同测试：GUI HttpApiClient 依赖的每个端点必须挂在真实 daemon router 上，
 * 且成功响应包含约定字段。缺失路由会使本测试失败。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLIENT_ROUTE_CONTRACT } from '../../src/daemon/server/routes/catalog.js';
import { setupRoutes } from '../../src/daemon/server/routes/index.js';
import { createStore } from '../../src/daemon/store/index.js';
import { createScheduler } from '../../src/daemon/scheduler/index.js';
import { createSecretsManager } from '../../src/daemon/secrets/index.js';
import { createSettingsStore } from '../../src/daemon/settings/index.js';
import { GroupManager } from '../../src/daemon/groups/index.js';
import { loadConfig } from '../../src/daemon/config.js';
import { getPackageVersion } from '../../src/shared/version.js';

function normalizePath(path: string): string {
  return path.replace(/\{(\w+)\}/g, ':$1');
}

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

describe('GUI ↔ daemon API contract', () => {
  let app: Hono;
  let tmp: string;
  let chiefId = '';

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'pi-bot-contract-'));
    process.env['PI_BOT_HOME'] = tmp;
    process.env['PI_CODING_AGENT_DIR'] = join(tmp, 'pi-agent');
    const config = await loadConfig();
    const store = await createStore(config);
    await store.bootstrap();
    const bots = await store.listBots();
    chiefId = bots[0]?.id ?? '';

    const scheduler = await createScheduler({
      storePath: join(tmp, 'schedules.json'),
      onTrigger: async () => {},
    });
    const secrets = await createSecretsManager({ storePath: join(tmp, 'secrets.json') });
    const settingsStore = await createSettingsStore(tmp);

    const fakePool = {
      sendMessage: async () => {
        throw new Error('no model in contract test');
      },
      on: () => fakePool,
      off: () => fakePool,
    };

    const fakeTeam = {
      messageBot: async () => ({ ok: true }),
      askUser: async () => ({ questionId: 'q-1' }),
      answerQuestion: async () => {},
      listQuestions: async () => [],
      listExchanges: async () => [],
      getExchange: async () => null,
    };

    const groupManager = new GroupManager(store, fakePool as never);

    const fakeUsage = {
      query: async () => ({ records: [], total: 0 }),
      aggregate: async () => [],
      getBotStats: async () => ({
        totalInputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        callCount: 0,
      }),
      clearOldRecords: async () => 0,
    };

    app = new Hono();
    const health = {
      status: 'ok',
      version: getPackageVersion(),
      pid: process.pid,
      home: tmp,
      timestamp: new Date().toISOString(),
    };
    app.get('/health', (c) => c.json(health));
    app.get('/api/health', (c) => c.json({ success: true, data: health }));

    setupRoutes(app, store, config, {
      sessionPool: fakePool as never,
      teamCoordinator: fakeTeam as never,
      groupManager,
      scheduler,
      secrets,
      usage: fakeUsage as never,
      settingsStore,
      respirePort: 15169,
    });
  });

  afterAll(async () => {
    if (tmp) {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('registers every client endpoint on the real router', () => {
    const registered = new Set(
      app.routes.map((r) => routeKey(r.method, r.path))
    );

    const missing: string[] = [];
    for (const contract of CLIENT_ROUTE_CONTRACT) {
      const key = routeKey(contract.method, contract.path);
      if (!registered.has(key)) {
        missing.push(key);
      }
    }

    expect(missing, `Missing routes:\n${missing.join('\n')}`).toEqual([]);
  });

  it('returns expected response shapes for GUI endpoints', async () => {
    const samples: Array<{ method: string; path: string; body?: unknown; status?: number[] }> = [
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/bots' },
      { method: 'GET', path: `/api/bots/${chiefId}` },
      { method: 'GET', path: `/api/bots/${chiefId}/history` },
      { method: 'GET', path: '/api/groups' },
      { method: 'GET', path: '/api/memory/status' },
      { method: 'GET', path: '/api/memory/search?limit=50' },
      { method: 'GET', path: '/api/memory/summary?scope=team' },
      { method: 'GET', path: '/api/tasks' },
      { method: 'GET', path: '/api/secrets' },
      { method: 'GET', path: '/api/usage' },
      { method: 'GET', path: '/api/usage/stats?period=week' },
      { method: 'GET', path: '/api/usage/records' },
      { method: 'GET', path: '/api/settings' },
      { method: 'GET', path: '/api/models' },
      { method: 'GET', path: '/api/providers' },
      { method: 'GET', path: '/api/system/status' },
      { method: 'GET', path: '/api/system/models' },
    ];

    for (const sample of samples) {
      const res = await app.request(sample.path, { method: sample.method });
      expect(res.status, `${sample.method} ${sample.path} should not 404`).not.toBe(404);

      const json = (await res.json()) as Record<string, unknown>;
      const pathOnly = sample.path.split('?')[0]!;
      const contract = CLIENT_ROUTE_CONTRACT.find((c) => {
        if (c.method !== sample.method) return false;
        if (c.path === pathOnly) return true;
        const pattern = new RegExp(
          `^${c.path.replace(/:[A-Za-z]+/g, '[^/]+')}$`
        );
        return pattern.test(pathOnly);
      });

      if (contract?.envelope === false) {
        for (const key of contract.dataKeys) {
          expect(json, `${sample.path} missing ${key}`).toHaveProperty(key);
        }
      } else {
        expect(json.success, `${sample.path} success`).toBe(true);
        const data = json.data as Record<string, unknown>;
        expect(data, `${sample.path} data`).toBeTruthy();
        if (contract) {
          for (const key of contract.dataKeys) {
            expect(data, `${sample.path} data.${key}`).toHaveProperty(key);
          }
        }
      }
    }
  });

  it('usage stats includes GUI total.inputTokens shape', async () => {
    const res = await app.request('/api/usage/stats?period=week');
    const json = await res.json() as { success: boolean; data: { stats: { total: { inputTokens: number } } } };
    expect(json.success).toBe(true);
    expect(json.data.stats.total.inputTokens).toBeTypeOf('number');
  });

  it('settings GET/PATCH persist', async () => {
    const patch = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'en-US',
        idleTimeoutMinutes: 15,
        defaultModel: null,
        loadUserExtensions: true,
      }),
    });
    const patched = await patch.json() as {
      success: boolean;
      data: { settings: {
        language: string;
        idleTimeoutMinutes: number;
        defaultModel: null;
        loadUserExtensions: boolean;
        workdir: string;
      } };
    };
    expect(patched.success).toBe(true);
    expect(patched.data.settings.language).toBe('en-US');
    expect(patched.data.settings.idleTimeoutMinutes).toBe(15);
    expect(patched.data.settings.defaultModel).toBeNull();
    expect(patched.data.settings.loadUserExtensions).toBe(true);
    expect(patched.data.settings.workdir).toBeTruthy();

    const get = await app.request('/api/settings');
    const got = await get.json() as { data: { settings: { language: string; defaultModel: null } } };
    expect(got.data.settings.language).toBe('en-US');
    expect(got.data.settings.defaultModel).toBeNull();
  });

  it('models catalog is from the SDK, not the hardcoded deepseek list', async () => {
    const res = await app.request('/api/models');
    const json = await res.json() as {
      success: boolean;
      data: {
        models: Array<{ provider: string; id: string; hasAuth: boolean; reasoning: boolean; input: string[] }>;
        defaultModel: { provider: string; id: string } | null;
        defaultThinking: string | null;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.models.length).toBeGreaterThan(2);
    expect(json.data.models.every((m) => typeof m.hasAuth === 'boolean')).toBe(true);
    const ids = json.data.models.map((m) => `${m.provider}/${m.id}`);
    expect(ids).not.toEqual(['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner']);

    const alias = await app.request('/api/system/models');
    const aliased = await alias.json() as { data: { models: unknown[] } };
    expect(aliased.data.models).toHaveLength(json.data.models.length);
  });
});
