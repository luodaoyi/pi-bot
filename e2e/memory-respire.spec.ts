/**
 * Playwright E2E: real daemon + fake Respire RPC returning production envelope shapes.
 * Memory page must list latest entries (not empty / not 500).
 */
import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startFakeRespire, stopFakeRespire } from '../tests/helpers/fake-respire.js';
import type { Server } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PI_BOT_E2E_MEMORY_PORT || 18788);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_HOME = join(tmpdir(), `pi-bot-e2e-mem-${process.pid}`);
const SCREEN_DIR = join(__dirname, 'screenshots');

let daemon: ChildProcess | null = null;
let respire: Server | null = null;

function attachGuards(page: Page) {
  const errors: string[] = [];
  const apiFailures: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`));
  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/api')) return;
    if (response.status() >= 400) {
      apiFailures.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });
  return {
    assertClean: async (label: string) => {
      expect(await page.locator('text=出错了').count(), `${label}: ErrorBoundary`).toBe(0);
      expect(errors, `${label}: console\n${errors.join('\n')}`).toEqual([]);
      expect(apiFailures, `${label}: /api\n${apiFailures.join('\n')}`).toEqual([]);
    },
  };
}

test.beforeAll(async () => {
  mkdirSync(SCREEN_DIR, { recursive: true });
  if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
  mkdirSync(TEST_HOME, { recursive: true });

  const fake = await startFakeRespire(0);
  respire = fake.server;

  const cliPath = join(__dirname, '../dist/cli.js');
  if (!existsSync(cliPath)) {
    throw new Error('dist/cli.js missing — build the package first');
  }

  daemon = spawn(process.execPath, [cliPath, 'serve', '--port', String(PORT)], {
    env: {
      ...process.env,
      PI_BOT_HOME: TEST_HOME,
      RSRS_RPC_PORT: String(fake.port),
    },
    stdio: 'pipe',
  });

  let retries = 40;
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
  if (retries === 0) throw new Error('Daemon failed to start for memory E2E');
});

test.afterAll(async () => {
  if (daemon) {
    daemon.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 800));
    if (daemon.exitCode === null) daemon.kill('SIGKILL');
  }
  if (respire) await stopFakeRespire(respire);
  if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
});

test('Memory page lists latest Respire entries and opens markdown detail', async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto(`${BASE_URL}/memory`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('加载中')).toHaveCount(0, { timeout: 5000 });

  await expect(page.getByTestId('memory-counts')).toContainText('local_alive');
  await expect(page.getByTestId('memory-entry-title').first()).toContainText('Respire中英文文档');
  await expect(page.getByText('Respire not running')).toHaveCount(0);
  await page.screenshot({ path: join(SCREEN_DIR, 'memory-list.png'), fullPage: true });

  await page.getByTestId('memory-entry').first().click();
  await expect(page.getByTestId('memory-detail')).toBeVisible();
  await expect(page.getByTestId('memory-detail-content')).toContainText('Acceptance notes');
  await page.screenshot({ path: join(SCREEN_DIR, 'memory-detail.png'), fullPage: true });
  await page.getByTestId('memory-detail-close').click();

  await page.getByTestId('memory-search').fill('pi-bot');
  await page.getByTestId('memory-search-submit').click();
  await expect(page.getByText('未找到相关记忆')).toBeVisible();
  await expect(page.getByText('出错了')).toHaveCount(0);

  await page.getByTestId('memory-search').fill('文档');
  await page.getByTestId('memory-search-submit').click();
  await expect(page.getByTestId('memory-entry-title').first()).toContainText('Respire');
  await guards.assertClean('memory-respire');
});
