/**
 * Windows 黑色控制台：instrument spawn，拉起 detached daemon，
 * 断言每个子进程都带 windowsHide；并检查 open/status/stop 退出码。
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { injectWindowsHideArgs } from '../src/daemon/win-hide.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repoRoot, 'dist', 'cli.js');

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on('error', reject);
  });
}

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env,
      cwd: repoRoot,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function waitForHealth(port: number, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return true;
    } catch {
      // 还没起来
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

describe('Windows spawn hide + CLI lifecycle', () => {
  const temps: string[] = [];

  afterAll(async () => {
    await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('covers the child_process option shapes used by SDK/cross-spawn', () => {
    const cases: unknown[][] = [
      ['npm', ['root', '-g']],
      ['pnpm', ['list', '-g'], { stdio: 'ignore' }],
      ['cmd', ['/c', 'start', '""', 'http://x'], { detached: true, stdio: 'ignore' }],
      ['powershell', { encoding: 'utf8' }],
    ];
    for (const input of cases) {
      const patched = injectWindowsHideArgs(input);
      const options = patched.find(
        (value) => value && typeof value === 'object' && !Array.isArray(value)
      ) as { windowsHide?: boolean };
      expect(options.windowsHide, JSON.stringify(input)).toBe(true);
    }
  });

  it.skipIf(!existsSync(cliPath))(
    'spawns a detached daemon whose children have windowsHide; open/status/stop exit 0',
    async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'pi-bot-win-spawn-'));
      temps.push(tmp);
      const port = await getFreePort();
      const spawnLog = join(tmp, 'spawn.jsonl');
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PI_BOT_HOME: tmp,
        PI_CODING_AGENT_DIR: join(tmp, 'pi-agent'),
        PI_BOT_SPAWN_LOG: spawnLog,
        PI_BOT_TEST_SPAWN: '1',
      };

      const opened = await runCli(['open', '--no-browser', '--port', String(port)], env);
      expect(opened.code, `${opened.stdout}\n${opened.stderr}`).toBe(0);
      expect(await waitForHealth(port)).toBe(true);

      const status = await runCli(['status'], env);
      expect(status.code, status.stdout + status.stderr).toBe(0);

      if (existsSync(spawnLog)) {
        const lines = (await readFile(spawnLog, 'utf-8'))
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { windowsHide?: boolean; command?: string });
        expect(lines.length).toBeGreaterThan(0);
        for (const entry of lines) {
          expect(entry.windowsHide, JSON.stringify(entry)).toBe(true);
        }
      } else if (process.platform === 'win32') {
        throw new Error('PI_BOT_SPAWN_LOG was not written by the detached daemon');
      }

      const stopped = await runCli(['stop'], env);
      expect(stopped.code, stopped.stdout + stopped.stderr).toBe(0);
    },
    60_000
  );
});
