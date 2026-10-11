/**
 * 发布冒烟：真实 daemon +（可选）PI_BOT_FAUX。
 * 覆盖 models / providers hasAuth / 会话 CRUD / faux 聊天 SSE / usage / settings。
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PI_BOT_E2E_PORT || 18791);
const EXTERNAL_URL = process.env.PI_BOT_E2E_URL;
const BASE_URL = EXTERNAL_URL || `http://127.0.0.1:${PORT}`;
const TEST_HOME = process.env.PI_BOT_E2E_HOME || join(tmpdir(), `pi-bot-smoke-${process.pid}`);
const AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(TEST_HOME, 'pi-agent');
const SCREEN_DIR = join(__dirname, 'screenshots');

let daemon: ChildProcess | null = null;
let startedByTest = false;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = (await response.json()) as { success?: boolean; data?: T; error?: string };
  if (!response.ok || json.success === false) {
    throw new Error(`${response.status} ${path}: ${json.error || response.statusText}`);
  }
  return json.data as T;
}

async function waitReady(page: Page, name: string) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('加载中', { exact: false })).toHaveCount(0, { timeout: 8000 });
  mkdirSync(SCREEN_DIR, { recursive: true });
  await page.screenshot({ path: join(SCREEN_DIR, `${name}.png`), fullPage: true });
}

test.beforeAll(async () => {
  mkdirSync(SCREEN_DIR, { recursive: true });
  if (EXTERNAL_URL) return;

  if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
  mkdirSync(AGENT_DIR, { recursive: true });

  const cliPath = join(__dirname, '../dist/cli.js');
  if (!existsSync(cliPath)) throw new Error('dist/cli.js missing — build first');

  daemon = spawn(process.execPath, [cliPath, 'serve', '--port', String(PORT)], {
    env: {
      ...process.env,
      PI_BOT_HOME: TEST_HOME,
      PI_CODING_AGENT_DIR: AGENT_DIR,
      PI_BOT_FAUX: '1',
    },
    stdio: 'pipe',
  });
  startedByTest = true;

  let retries = 50;
  while (retries > 0) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) break;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 250));
    retries--;
  }
  if (retries === 0) throw new Error('Smoke daemon failed to start');
});

test.afterAll(async () => {
  if (startedByTest && daemon) {
    daemon.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 800));
    if (daemon.exitCode === null) daemon.kill('SIGKILL');
  }
  if (startedByTest && existsSync(TEST_HOME)) {
    rmSync(TEST_HOME, { recursive: true, force: true });
  }
});

test.describe('integration smoke (real daemon + faux)', () => {
  test.skip(
    !process.env.PI_BOT_SMOKE && !process.env.PI_BOT_E2E_URL,
    'manual release smoke — set PI_BOT_SMOKE=1 or PI_BOT_E2E_URL'
  );

  test('models, provider auth, sessions, faux chat SSE, usage, settings', async ({ page }) => {
    const catalog = await api<{
      models: Array<{ provider: string; id: string; hasAuth: boolean }>;
    }>('/api/models');
    expect(catalog.models.length).toBeGreaterThan(5);
    expect(catalog.models.some((m) => m.provider === 'faux' && m.id === 'faux-1')).toBe(true);

    const openai = catalog.models.find((m) => m.provider === 'openai');
    expect(openai, 'SDK openai models present').toBeTruthy();

    await api('/api/providers/openai/api-key', {
      method: 'PUT',
      body: JSON.stringify({ apiKey: 'sk-fake-smoke-key' }),
    });
    const afterKey = await api<{
      models: Array<{ provider: string; id: string; hasAuth: boolean }>;
    }>('/api/models');
    expect(afterKey.models.filter((m) => m.provider === 'openai').every((m) => m.hasAuth)).toBe(true);

    const bots = await api<{ bots: Array<{ id: string; name: string }> }>('/api/bots');
    const chief = bots.bots.find((b) => b.name === 'Chief') ?? bots.bots[0];
    expect(chief).toBeTruthy();

    await api(`/api/bots/${chief.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ model: { provider: 'faux', id: 'faux-1' } }),
    });

    const created = await api<{ session: { id: string; name?: string } }>(`/api/bots/${chief.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Smoke Alpha' }),
    });
    expect(created.session.id).toBeTruthy();

    const listed = await api<{ sessions: Array<{ id: string; name?: string }> }>(
      `/api/bots/${chief.id}/sessions`
    );
    expect(listed.sessions.some((s) => s.id === created.session.id)).toBe(true);

    const renamed = await api<{ session: { name?: string } }>(
      `/api/bots/${chief.id}/sessions/${created.session.id}`,
      { method: 'PATCH', body: JSON.stringify({ name: 'Smoke Renamed' }) }
    );
    expect(renamed.session.name).toBe('Smoke Renamed');

    await page.goto(`${BASE_URL}/bots`);
    await waitReady(page, 'smoke-chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await page.getByTestId('chat-input').fill('say hello from faux');
    await page.getByTestId('chat-input').press('Enter');
    await expect(page.getByText('hello from faux stream')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: join(SCREEN_DIR, 'smoke-faux-chat.png'), fullPage: true });

    const afterChat = await api<{
      sessions: Array<{ id: string; isActive?: boolean }>;
    }>(`/api/bots/${chief.id}/sessions`);
    expect(afterChat.sessions.some((s) => s.id === created.session.id)).toBe(true);
    const chatSession =
      afterChat.sessions.find((s) => s.isActive)?.id ?? created.session.id;

    const detail = await api<{
      session: { id: string };
      messages: unknown[];
      stats: { tokens: { total: number } };
    }>(`/api/bots/${chief.id}/sessions/${chatSession}`);
    expect(detail.messages.length).toBeGreaterThan(0);

    const fork = await api<{ session: { id: string } }>(
      `/api/bots/${chief.id}/sessions/${chatSession}/fork`,
      { method: 'POST', body: JSON.stringify({ entryId: 'head' }) }
    );
    expect(fork.session.id).toBeTruthy();
    expect(fork.session.id).not.toBe(chatSession);

    await api(`/api/bots/${chief.id}/sessions/${fork.session.id}`, { method: 'DELETE' });
    const afterDelete = await api<{ sessions: Array<{ id: string }> }>(`/api/bots/${chief.id}/sessions`);
    expect(afterDelete.sessions.map((s) => s.id)).not.toContain(fork.session.id);

    await page.goto(`${BASE_URL}/usage`);
    await waitReady(page, 'smoke-usage');
    await expect(page.getByText('用量统计')).toBeVisible();
    const usage = await api<{
      stats?: { total?: { inputTokens?: number; outputTokens?: number } };
    }>('/api/usage/stats?period=week');
    const inputTokens = usage.stats?.total?.inputTokens ?? 0;
    const outputTokens = usage.stats?.total?.outputTokens ?? 0;
    expect(inputTokens + outputTokens).toBeGreaterThan(0);

    await page.goto(`${BASE_URL}/settings`);
    await waitReady(page, 'smoke-settings');
    for (const tab of ['general', 'models', 'providers', 'sessions', 'memory'] as const) {
      await page.getByTestId(`settings-tab-${tab}`).click();
      await page.screenshot({ path: join(SCREEN_DIR, `smoke-settings-${tab}.png`), fullPage: true });
    }

    await page.getByTestId('settings-tab-general').click();
    await page.locator('input').first().fill('Asia/Shanghai');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('button', { name: '保存' })).toBeEnabled({ timeout: 5000 });

    await page.getByTestId('settings-tab-sessions').click();
    const timeout = page.locator('input[type="number"]').nth(1);
    await timeout.fill('12');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('button', { name: '保存' })).toBeEnabled({ timeout: 5000 });

    await page.getByTestId('settings-tab-memory').click();
    const review = page.locator('input[type="checkbox"]').first();
    if (!(await review.isChecked())) await review.check();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('button', { name: '保存' })).toBeEnabled({ timeout: 5000 });

    const settings = await api<{
      settings: { idleTimeoutMinutes: number; timezone: string; memoryReview: boolean };
    }>('/api/settings');
    expect(settings.settings.idleTimeoutMinutes).toBe(12);
    expect(settings.settings.timezone).toBe('Asia/Shanghai');
    expect(settings.settings.memoryReview).toBe(true);
    await page.screenshot({ path: join(SCREEN_DIR, 'smoke-settings-saved.png'), fullPage: true });
  });
});
