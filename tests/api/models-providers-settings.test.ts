/**
 * models / providers / settings 路由测试。
 * 使用临时 PI_CODING_AGENT_DIR，绝不碰真实 ~/.pi/agent/auth.json。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupRoutes } from '../../src/daemon/server/routes/index.js';
import { createStore } from '../../src/daemon/store/index.js';
import { createSettingsStore } from '../../src/daemon/settings/index.js';
import { loadConfig } from '../../src/daemon/config.js';
import { invalidateModelRuntime } from '../../src/daemon/models/runtime.js';
import { resetOAuthFlowsForTests } from '../../src/daemon/models/providers.js';

describe('models / providers / settings routes', () => {
  let app: Hono;
  let tmp: string;
  let agentDir: string;
  const previousAgentDir = process.env['PI_CODING_AGENT_DIR'];
  const previousHome = process.env['PI_BOT_HOME'];

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'pi-bot-models-'));
    agentDir = join(tmp, 'pi-agent');
    await mkdir(agentDir, { recursive: true });
    process.env['PI_BOT_HOME'] = tmp;
    process.env['PI_CODING_AGENT_DIR'] = agentDir;
    invalidateModelRuntime();

    const config = await loadConfig();
    const store = await createStore(config);
    const settingsStore = await createSettingsStore(tmp);

    app = new Hono();
    setupRoutes(app, store, config, { settingsStore, respirePort: 15169 });
  });

  afterAll(async () => {
    resetOAuthFlowsForTests();
    invalidateModelRuntime();
    if (previousAgentDir === undefined) delete process.env['PI_CODING_AGENT_DIR'];
    else process.env['PI_CODING_AGENT_DIR'] = previousAgentDir;
    if (previousHome === undefined) delete process.env['PI_BOT_HOME'];
    else process.env['PI_BOT_HOME'] = previousHome;
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });

  it('GET /api/models lists SDK models with hasAuth and pi defaults', async () => {
    await writeFile(
      join(agentDir, 'settings.json'),
      JSON.stringify({ defaultProvider: 'openai', defaultModel: 'gpt-5', defaultThinkingLevel: 'low' }, null, 2)
    );
    invalidateModelRuntime();

    const res = await app.request('/api/models');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: {
        models: Array<{
          provider: string;
          id: string;
          name: string;
          contextWindow: number;
          reasoning: boolean;
          input: string[];
          hasAuth: boolean;
        }>;
        defaultModel: { provider: string; id: string } | null;
        defaultThinking: string | null;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.models.length).toBeGreaterThan(5);
    const sample = json.data.models[0]!;
    expect(sample.provider).toBeTruthy();
    expect(sample.id).toBeTruthy();
    expect(typeof sample.hasAuth).toBe('boolean');
    expect(Array.isArray(sample.input)).toBe(true);
    expect(json.data.models.every((m) => m.hasAuth === false)).toBe(true);
    expect(json.data.defaultModel).toEqual({ provider: 'openai', id: 'gpt-5' });
    expect(json.data.defaultThinking).toBe('low');
  });

  it('GET /api/system/models is an alias', async () => {
    const a = await app.request('/api/models');
    const b = await app.request('/api/system/models');
    const left = (await a.json()) as { data: { models: unknown[] } };
    const right = (await b.json()) as { data: { models: unknown[] } };
    expect(right.data.models).toHaveLength(left.data.models.length);
  });

  it('GET /api/providers lists SDK providers without leaking secrets', async () => {
    const res = await app.request('/api/providers');
    const json = (await res.json()) as {
      success: boolean;
      data: { providers: Array<{ id: string; name: string; authType: string; configured: boolean; source: string | null }> };
    };
    expect(json.success).toBe(true);
    expect(json.data.providers.length).toBeGreaterThan(3);
    expect(json.data.providers.every((p) => ['apiKey', 'oauth', 'both'].includes(p.authType))).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/sk-|api[_-]?key["']\s*:/i);
  });

  it('PUT /api/providers/:id/api-key writes auth.json via AuthStorage lock and never returns the key', async () => {
    const secret = 'sk-test-do-not-log-this-value';
    const res = await app.request('/api/providers/openai/api-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: secret }),
    });
    const json = (await res.json()) as { success: boolean; data: { configured: boolean }; error?: string };
    expect(res.status, json.error).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.configured).toBe(true);
    expect(JSON.stringify(json)).not.toContain(secret);

    const authRaw = await readFile(join(agentDir, 'auth.json'), 'utf-8');
    const auth = JSON.parse(authRaw) as Record<string, { type?: string; key?: string }>;
    expect(auth['openai']?.type).toBe('api_key');
    expect(auth['openai']?.key).toBe(secret);

    invalidateModelRuntime();
    const listed = await app.request('/api/providers');
    const listing = (await listed.json()) as {
      data: { providers: Array<{ id: string; configured: boolean; source: string | null }> };
    };
    const openai = listing.data.providers.find((p) => p.id === 'openai');
    expect(openai?.configured).toBe(true);
    expect(openai?.source).toBe('auth.json');

    const models = await app.request('/api/models');
    const catalog = (await models.json()) as { data: { models: Array<{ provider: string; hasAuth: boolean }> } };
    expect(catalog.data.models.some((m) => m.provider === 'openai' && m.hasAuth)).toBe(true);
  });

  it('DELETE /api/providers/:id/auth removes the stored credential', async () => {
    const res = await app.request('/api/providers/openai/auth', { method: 'DELETE' });
    const json = (await res.json()) as { success: boolean; data: { configured: boolean } };
    expect(json.success).toBe(true);
    expect(json.data.configured).toBe(false);

    const auth = JSON.parse(await readFile(join(agentDir, 'auth.json'), 'utf-8')) as Record<string, unknown>;
    expect(auth['openai']).toBeUndefined();
  });

  it('rejects empty API keys and unknown providers', async () => {
    const empty = await app.request('/api/providers/openai/api-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: '   ' }),
    });
    expect(empty.status).toBe(400);

    const unknown = await app.request('/api/providers/not-a-real-provider/api-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk-x' }),
    });
    expect(unknown.status).toBe(404);
  });

  it('OAuth start returns 501 with a clear message when the provider has no OAuth flow', async () => {
    const listed = await app.request('/api/providers');
    const listing = (await listed.json()) as {
      data: { providers: Array<{ id: string; authType: string }> };
    };
    const apiKeyOnly = listing.data.providers.find((p) => p.authType === 'apiKey');
    expect(apiKeyOnly).toBeTruthy();
    const res = await app.request(`/api/providers/${apiKeyOnly!.id}/oauth/start`, { method: 'POST' });
    expect(res.status).toBe(501);
    const json = (await res.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/OAuth|api-key|pi \/login/i);
  });

  it('PATCH /api/settings persists contract fields in pi-bot home', async () => {
    const patch = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'en-US',
        theme: 'dark',
        maxSessions: 8,
        idleTimeoutMinutes: 20,
        defaultModel: { provider: 'anthropic', id: 'claude-opus-4-6' },
        defaultThinking: 'medium',
        loadUserExtensions: true,
        loadContextFiles: true,
        timezone: 'Asia/Shanghai',
        workdir: join(tmp, 'custom-work'),
      }),
    });
    const json = (await patch.json()) as { success: boolean; data: { settings: Record<string, unknown> } };
    expect(json.success).toBe(true);
    expect(json.data.settings['defaultModel']).toEqual({ provider: 'anthropic', id: 'claude-opus-4-6' });
    expect(json.data.settings['defaultThinking']).toBe('medium');
    expect(json.data.settings['idleTimeoutMinutes']).toBe(20);

    const stored = JSON.parse(await readFile(join(tmp, 'settings.json'), 'utf-8')) as { defaultModel: unknown };
    expect(stored.defaultModel).toEqual({ provider: 'anthropic', id: 'claude-opus-4-6' });

    const clear = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultModel: null }),
    });
    const cleared = (await clear.json()) as { data: { settings: { defaultModel: unknown } } };
    expect(cleared.data.settings.defaultModel).toBeNull();
  });
});
