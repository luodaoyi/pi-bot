/**
 * 在导入 pi SDK / cross-spawn 之前给 child_process 补上 windowsHide，
 * 避免 detached daemon 在 Windows 上弹出黑色控制台窗口。
 *
 * 必须作为 daemon 入口的第一个 import。
 */
import cp from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const METHODS = [
  'spawn',
  'spawnSync',
  'execFile',
  'execFileSync',
  'exec',
  'execSync',
  'fork',
] as const;

type ChildProcessMethod = (typeof METHODS)[number];

let applied = false;

function isOptionsObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 给 spawn/exec/fork 参数补上默认 windowsHide:true。
 * 已有 options 里的 windowsHide 优先生效（不会强行覆盖 false）。
 */
export function injectWindowsHideArgs(args: unknown[]): unknown[] {
  const next = args.slice();
  const optionsIndex = next.findIndex(
    (value, index) => index > 0 && isOptionsObject(value)
  );

  if (optionsIndex >= 0) {
    const existing = next[optionsIndex] as Record<string, unknown>;
    next[optionsIndex] = { windowsHide: true, ...existing };
    return next;
  }

  if (typeof next[next.length - 1] === 'function') {
    next.splice(next.length - 1, 0, { windowsHide: true });
    return next;
  }

  next.push({ windowsHide: true });
  return next;
}

function commandName(args: unknown[]): string {
  return typeof args[0] === 'string' ? args[0] : '[non-string]';
}

function readWindowsHide(args: unknown[]): boolean {
  for (let i = args.length - 1; i >= 0; i--) {
    const value = args[i];
    if (isOptionsObject(value) && typeof value['windowsHide'] === 'boolean') {
      return value['windowsHide'];
    }
  }
  return false;
}

function logSpawn(method: ChildProcessMethod, args: unknown[]): void {
  const logPath = process.env['PI_BOT_SPAWN_LOG'];
  if (!logPath) return;
  const line = JSON.stringify({
    method,
    command: commandName(args),
    windowsHide: readWindowsHide(args),
  });
  try {
    appendFileSync(logPath, `${line}\n`);
  } catch {
    // 测试探测失败不应影响 daemon
  }
}

export function isWindowsHidePatched(): boolean {
  return applied;
}

export function applyWindowsHidePatch(options?: {
  hide?: boolean;
  log?: boolean;
}): void {
  if (applied) return;

  const hide = options?.hide ?? process.platform === 'win32';
  const log = options?.log ?? Boolean(process.env['PI_BOT_SPAWN_LOG']);
  if (!hide && !log) return;

  for (const method of METHODS) {
    const original = (cp as Record<string, unknown>)[method];
    if (typeof original !== 'function') continue;
    (cp as Record<string, unknown>)[method] = function patched(
      this: unknown,
      ...rawArgs: unknown[]
    ) {
      const args = hide ? injectWindowsHideArgs(rawArgs) : rawArgs;
      if (log) logSpawn(method, args);
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    };
  }

  syncBuiltinESMExports();
  applied = true;
}

const testSpawn = process.env['PI_BOT_TEST_SPAWN'] === '1';
applyWindowsHidePatch({
  hide: process.platform === 'win32' || testSpawn,
  log: Boolean(process.env['PI_BOT_SPAWN_LOG']) || testSpawn,
});

if (testSpawn) {
  // 让 Windows CI 能断言 daemon 子进程一定带 windowsHide
  cp.spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
}
