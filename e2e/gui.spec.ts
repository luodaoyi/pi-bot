/**
 * E2E test for pi-bot web GUI
 * Tests all pages with real daemon API, fails on console errors or ErrorBoundary
 */

import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { join, dirname } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 8787;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_HOME = join(homedir(), '.pi-bot-test-e2e');

let daemon: ChildProcess | null = null;

test.beforeAll(async () => {
  // Clean test home
  if (existsSync(TEST_HOME)) {
    rmSync(TEST_HOME, { recursive: true, force: true });
  }

  // Start daemon with test home
  const cliPath = join(__dirname, '../dist/cli.js');
  
  daemon = spawn(process.execPath, [cliPath, 'serve', '--port', PORT.toString()], {
    env: { ...process.env, PI_BOT_HOME: TEST_HOME },
    detached: false,
    stdio: 'inherit',
  });

  // Wait for daemon to be ready
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        console.log('✓ Daemon ready');
        break;
      }
    } catch {
      // Ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    retries--;
  }

  if (retries === 0) {
    throw new Error('Daemon failed to start');
  }
});

test.afterAll(async () => {
  // Stop daemon
  if (daemon) {
    daemon.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (daemon.exitCode === null) {
      daemon.kill('SIGKILL');
    }
  }

  // Clean test home
  if (existsSync(TEST_HOME)) {
    rmSync(TEST_HOME, { recursive: true, force: true });
  }
});

async function checkForErrors(page: Page) {
  // Check for console errors
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

async function checkNoErrorBoundary(page: Page) {
  // Check for ErrorBoundary text
  const errorBoundaryText = await page.locator('text=机器人加载失败').count();
  expect(errorBoundaryText).toBe(0);

  const pageLoadError = await page.locator('text=Page Load Error').count();
  expect(pageLoadError).toBe(0);
}

test.describe('PI-Bot Web GUI E2E', () => {
  test('should load homepage without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show main navigation
    await expect(page.locator('text=机器人')).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on homepage:\n${errors.join('\n')}`);
    }
  });

  test('should load Bots page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/bots`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show Chief bot (created by bootstrap)
    await expect(page.locator('text=Chief')).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Bots page:\n${errors.join('\n')}`);
    }
  });

  test('should load Chat page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show chat interface
    await expect(page.locator('textarea').or(page.locator('input[type="text"]'))).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Chat page:\n${errors.join('\n')}`);
    }
  });

  test('should load Groups page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/groups`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show groups list or empty state
    const hasGroups = await page.locator('text=创建群组').or(page.locator('text=新建群组')).count();
    expect(hasGroups).toBeGreaterThan(0);

    if (errors.length > 0) {
      throw new Error(`Console errors on Groups page:\n${errors.join('\n')}`);
    }
  });

  test('should load Memory page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/memory`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show memory interface
    await expect(page.locator('text=记忆').or(page.locator('text=Memory'))).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Memory page:\n${errors.join('\n')}`);
    }
  });

  test('should load Tasks page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show tasks/schedule interface
    await expect(page.locator('text=任务').or(page.locator('text=调度'))).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Tasks page:\n${errors.join('\n')}`);
    }
  });

  test('should load Secrets page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/secrets`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show secrets interface
    await expect(page.locator('text=密钥').or(page.locator('text=Secret'))).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Secrets page:\n${errors.join('\n')}`);
    }
  });

  test('should load Usage page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/usage`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show usage stats or empty state
    await expect(page.locator('text=使用统计').or(page.locator('text=Usage'))).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Usage page:\n${errors.join('\n')}`);
    }
  });

  test('should load Settings page without errors', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    await checkNoErrorBoundary(page);

    // Should show settings
    await expect(page.locator('text=设置').or(page.locator('text=Settings'))).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Console errors on Settings page:\n${errors.join('\n')}`);
    }
  });

  test('should handle navigation between pages', async ({ page }) => {
    const errors = await checkForErrors(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to each page via UI
    const pages = ['机器人', '对话', '群组', '记忆', '任务', '密钥', '使用统计', '设置'];
    
    for (const pageName of pages) {
      const link = page.locator(`text=${pageName}`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForLoadState('networkidle');
        await checkNoErrorBoundary(page);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Console errors during navigation:\n${errors.join('\n')}`);
    }
  });
});
