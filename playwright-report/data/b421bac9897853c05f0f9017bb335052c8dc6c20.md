# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gui.spec.ts >> PI-Bot Web GUI E2E >> should load homepage without errors
- Location: e2e/gui.spec.ts:99:3

# Error details

```
Error: Daemon failed to start
```

# Test source

```ts
  1   | /**
  2   |  * E2E test for pi-bot web GUI
  3   |  * Tests all pages with real daemon API, fails on console errors or ErrorBoundary
  4   |  */
  5   | 
  6   | import { test, expect, type Page } from '@playwright/test';
  7   | import { spawn, type ChildProcess } from 'node:child_process';
  8   | import { join, dirname } from 'node:path';
  9   | import { existsSync, rmSync } from 'node:fs';
  10  | import { homedir } from 'node:os';
  11  | import { fileURLToPath } from 'node:url';
  12  | 
  13  | const __dirname = dirname(fileURLToPath(import.meta.url));
  14  | 
  15  | const PORT = 8787;
  16  | const BASE_URL = `http://localhost:${PORT}`;
  17  | const TEST_HOME = join(homedir(), '.pi-bot-test-e2e');
  18  | 
  19  | let daemon: ChildProcess | null = null;
  20  | 
  21  | test.beforeAll(async () => {
  22  |   // Clean test home
  23  |   if (existsSync(TEST_HOME)) {
  24  |     rmSync(TEST_HOME, { recursive: true, force: true });
  25  |   }
  26  | 
  27  |   // Start daemon with test home
  28  |   const cliPath = join(__dirname, '../dist/cli.js');
  29  |   
  30  |   daemon = spawn(process.execPath, [cliPath, 'serve', '--port', PORT.toString()], {
  31  |     env: { ...process.env, PI_BOT_HOME: TEST_HOME },
  32  |     detached: false,
  33  |     stdio: 'inherit',
  34  |   });
  35  | 
  36  |   // Wait for daemon to be ready
  37  |   let retries = 30;
  38  |   while (retries > 0) {
  39  |     try {
  40  |       const response = await fetch(`${BASE_URL}/health`);
  41  |       if (response.ok) {
  42  |         console.log('✓ Daemon ready');
  43  |         break;
  44  |       }
  45  |     } catch {
  46  |       // Ignore
  47  |     }
  48  |     await new Promise((resolve) => setTimeout(resolve, 1000));
  49  |     retries--;
  50  |   }
  51  | 
  52  |   if (retries === 0) {
> 53  |     throw new Error('Daemon failed to start');
      |           ^ Error: Daemon failed to start
  54  |   }
  55  | });
  56  | 
  57  | test.afterAll(async () => {
  58  |   // Stop daemon
  59  |   if (daemon) {
  60  |     daemon.kill('SIGTERM');
  61  |     await new Promise((resolve) => setTimeout(resolve, 1000));
  62  |     if (daemon.exitCode === null) {
  63  |       daemon.kill('SIGKILL');
  64  |     }
  65  |   }
  66  | 
  67  |   // Clean test home
  68  |   if (existsSync(TEST_HOME)) {
  69  |     rmSync(TEST_HOME, { recursive: true, force: true });
  70  |   }
  71  | });
  72  | 
  73  | async function checkForErrors(page: Page) {
  74  |   // Check for console errors
  75  |   const errors: string[] = [];
  76  |   page.on('console', (msg) => {
  77  |     if (msg.type() === 'error') {
  78  |       errors.push(msg.text());
  79  |     }
  80  |   });
  81  | 
  82  |   page.on('pageerror', (error) => {
  83  |     errors.push(error.message);
  84  |   });
  85  | 
  86  |   return errors;
  87  | }
  88  | 
  89  | async function checkNoErrorBoundary(page: Page) {
  90  |   // Check for ErrorBoundary text
  91  |   const errorBoundaryText = await page.locator('text=机器人加载失败').count();
  92  |   expect(errorBoundaryText).toBe(0);
  93  | 
  94  |   const pageLoadError = await page.locator('text=Page Load Error').count();
  95  |   expect(pageLoadError).toBe(0);
  96  | }
  97  | 
  98  | test.describe('PI-Bot Web GUI E2E', () => {
  99  |   test('should load homepage without errors', async ({ page }) => {
  100 |     const errors = await checkForErrors(page);
  101 | 
  102 |     await page.goto(BASE_URL);
  103 |     await page.waitForLoadState('networkidle');
  104 | 
  105 |     await checkNoErrorBoundary(page);
  106 | 
  107 |     // Should show main navigation
  108 |     await expect(page.locator('text=机器人')).toBeVisible();
  109 | 
  110 |     if (errors.length > 0) {
  111 |       throw new Error(`Console errors on homepage:\n${errors.join('\n')}`);
  112 |     }
  113 |   });
  114 | 
  115 |   test('should load Bots page without errors', async ({ page }) => {
  116 |     const errors = await checkForErrors(page);
  117 | 
  118 |     await page.goto(`${BASE_URL}/bots`);
  119 |     await page.waitForLoadState('networkidle');
  120 | 
  121 |     await checkNoErrorBoundary(page);
  122 | 
  123 |     // Should show Chief bot (created by bootstrap)
  124 |     await expect(page.locator('text=Chief')).toBeVisible();
  125 | 
  126 |     if (errors.length > 0) {
  127 |       throw new Error(`Console errors on Bots page:\n${errors.join('\n')}`);
  128 |     }
  129 |   });
  130 | 
  131 |   test('should load Chat page without errors', async ({ page }) => {
  132 |     const errors = await checkForErrors(page);
  133 | 
  134 |     await page.goto(`${BASE_URL}/chat`);
  135 |     await page.waitForLoadState('networkidle');
  136 | 
  137 |     await checkNoErrorBoundary(page);
  138 | 
  139 |     // Should show chat interface
  140 |     await expect(page.locator('textarea').or(page.locator('input[type="text"]'))).toBeVisible();
  141 | 
  142 |     if (errors.length > 0) {
  143 |       throw new Error(`Console errors on Chat page:\n${errors.join('\n')}`);
  144 |     }
  145 |   });
  146 | 
  147 |   test('should load Groups page without errors', async ({ page }) => {
  148 |     const errors = await checkForErrors(page);
  149 | 
  150 |     await page.goto(`${BASE_URL}/groups`);
  151 |     await page.waitForLoadState('networkidle');
  152 | 
  153 |     await checkNoErrorBoundary(page);
```