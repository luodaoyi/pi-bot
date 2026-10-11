/**
 * Playwright E2E：真实 daemon + 无 API key + Respire 未运行。
 * 任一 /api 4xx/5xx、console.error、pageerror、ErrorBoundary、5s 后仍「加载中」即失败。
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PI_BOT_E2E_PORT || 18787);
const EXTERNAL_URL = process.env.PI_BOT_E2E_URL;
const BASE_URL = EXTERNAL_URL || `http://127.0.0.1:${PORT}`;
const TEST_HOME = process.env.PI_BOT_E2E_HOME || join(tmpdir(), `pi-bot-e2e-${process.pid}`);
const SCREEN_DIR = join(__dirname, 'screenshots');

let daemon: ChildProcess | null = null;
let startedByTest = false;

function attachGuards(page: Page) {
  const errors: string[] = [];
  const apiFailures: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[console.error] ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error.message}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/api')) return;
    if (response.status() >= 400) {
      apiFailures.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });

  return {
    assertClean: async (label: string) => {
      const boundary = await page.locator('text=出错了').count();
      expect(boundary, `${label}: ErrorBoundary visible`).toBe(0);
      expect(errors, `${label}: console/page errors\n${errors.join('\n')}`).toEqual([]);
      expect(apiFailures, `${label}: /api 4xx/5xx\n${apiFailures.join('\n')}`).toEqual([]);
    },
  };
}

async function waitReady(page: Page, screenshotName: string) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  const loading = page.getByText('加载中', { exact: false });
  try {
    await expect(loading).toHaveCount(0, { timeout: 5000 });
  } catch {
    await page.screenshot({ path: join(SCREEN_DIR, `${screenshotName}-loading-fail.png`), fullPage: true });
    throw new Error(`${screenshotName}: 「加载中」在 5s 后仍可见`);
  }
  mkdirSync(SCREEN_DIR, { recursive: true });
  await page.screenshot({ path: join(SCREEN_DIR, `${screenshotName}.png`), fullPage: true });
}

test.beforeAll(async () => {
  mkdirSync(SCREEN_DIR, { recursive: true });
  if (EXTERNAL_URL) {
    return;
  }

  if (existsSync(TEST_HOME)) {
    rmSync(TEST_HOME, { recursive: true, force: true });
  }
  mkdirSync(TEST_HOME, { recursive: true });

  const cliPath = join(__dirname, '../dist/cli.js');
  if (!existsSync(cliPath)) {
    throw new Error('dist/cli.js missing — build the package first');
  }

  daemon = spawn(process.execPath, [cliPath, 'serve', '--port', String(PORT)], {
    env: { ...process.env, PI_BOT_HOME: TEST_HOME },
    stdio: 'pipe',
  });
  startedByTest = true;

  let retries = 40;
  while (retries > 0) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) break;
    } catch {
      // 等待启动
    }
    await new Promise((r) => setTimeout(r, 250));
    retries--;
  }
  if (retries === 0) {
    throw new Error('Daemon failed to start for E2E');
  }
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

test.describe('PI-Bot Web GUI E2E (real daemon)', () => {
  test('visits every route and creates bot/group/task/secret', async ({ page }) => {
    const guards = attachGuards(page);

    await page.goto(`${BASE_URL}/`);
    await waitReady(page, 'root');
    await expect(page).toHaveURL(/\/bots/);
    await expect(page.getByText('Chief').first()).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await guards.assertClean('root/bots');

    await page.goto(`${BASE_URL}/bots`);
    await waitReady(page, 'bots');
    await expect(page.getByText('Chief').first()).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await page.screenshot({ path: join(SCREEN_DIR, 'chat-chief.png'), fullPage: true });
    await guards.assertClean('bots/chief');

    await page.getByRole('button', { name: '创建机器人' }).click();
    await page.getByTestId('bot-name-input').fill('E2E Writer');
    await page.getByTestId('bot-role-input').fill('tester');
    await page.getByTestId('bot-instructions-input').fill('E2E bot');
    await page.getByTestId('bot-create-submit').click();
    await expect(page.locator('[data-bot-name="E2E Writer"]')).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: join(SCREEN_DIR, 'bots-created.png'), fullPage: true });
    await guards.assertClean('create-bot');

    await page.goto(`${BASE_URL}/groups`);
    await waitReady(page, 'groups');
    await page.getByRole('button', { name: '创建群聊' }).click();
    await page.getByTestId('group-name-input').fill('E2E Group');
    await page.getByTestId('group-create-submit').click();
    await expect(page.locator('[data-group-name="E2E Group"]')).toBeVisible({ timeout: 8000 });
    await guards.assertClean('groups');

    await page.goto(`${BASE_URL}/memory`);
    await waitReady(page, 'memory');
    await expect(page.getByText('Respire not running')).toBeVisible();
    await expect(page.getByText('未找到相关记忆')).toHaveCount(0);
    await guards.assertClean('memory');

    await page.goto(`${BASE_URL}/tasks`);
    await waitReady(page, 'tasks');
    await page.getByRole('button', { name: '创建任务' }).click();
    await page.getByTestId('task-name-input').fill('E2E Task');
    await page.getByTestId('task-message-input').fill('hello from e2e');
    await page.getByTestId('task-create-submit').click();
    await expect(page.locator('[data-task-name]').filter({ hasText: 'E2E Task' })).toBeVisible({ timeout: 8000 });
    await guards.assertClean('tasks');

    await page.goto(`${BASE_URL}/secrets`);
    await waitReady(page, 'secrets');
    await page.getByRole('button', { name: '请求密钥' }).click();
    await page.getByTestId('secret-name-input').fill('E2E_SECRET');
    await page.getByTestId('secret-purpose-input').fill('e2e');
    await page.getByTestId('secret-value-input').fill('not-a-real-key');
    await page.getByTestId('secret-create-submit').click();
    await expect(page.locator('[data-secret-name="E2E_SECRET"]')).toBeVisible({ timeout: 8000 });
    await guards.assertClean('secrets');

    await page.goto(`${BASE_URL}/usage`);
    await waitReady(page, 'usage');
    await expect(page.getByText('用量统计')).toBeVisible();
    await guards.assertClean('usage');

    await page.goto(`${BASE_URL}/settings`);
    await waitReady(page, 'settings');
    await expect(page.getByText('设置').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible();
    await guards.assertClean('settings');
  });
});
