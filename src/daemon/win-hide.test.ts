import { describe, expect, it } from 'vitest';
import { injectWindowsHideArgs } from './win-hide.js';

function optionsOf(args: unknown[]): Record<string, unknown> | undefined {
  return [...args]
    .reverse()
    .find((value) => value && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function') as
    | Record<string, unknown>
    | undefined;
}

describe('injectWindowsHideArgs', () => {
  it('appends options for spawn(cmd, args)', () => {
    const args = injectWindowsHideArgs(['node', ['-e', '0']]);
    expect(optionsOf(args)?.['windowsHide']).toBe(true);
  });

  it('merges into existing spawn options without dropping stdio', () => {
    const args = injectWindowsHideArgs(['node', ['-e', '0'], { stdio: 'ignore', detached: true }]);
    expect(args[2]).toMatchObject({ windowsHide: true, stdio: 'ignore', detached: true });
  });

  it('preserves an explicit windowsHide:false', () => {
    const args = injectWindowsHideArgs(['cmd', { windowsHide: false }]);
    expect(optionsOf(args)?.['windowsHide']).toBe(false);
  });

  it('inserts options before exec callback', () => {
    const cb = () => undefined;
    const args = injectWindowsHideArgs(['echo hi', cb]);
    expect(args[1]).toMatchObject({ windowsHide: true });
    expect(args[2]).toBe(cb);
  });

  it('handles exec(cmd, options, cb)', () => {
    const cb = () => undefined;
    const args = injectWindowsHideArgs(['echo hi', { timeout: 1000 }, cb]);
    expect(args[1]).toMatchObject({ windowsHide: true, timeout: 1000 });
    expect(args[2]).toBe(cb);
  });

  it('handles execFile(file, args, cb)', () => {
    const cb = () => undefined;
    const args = injectWindowsHideArgs(['node', ['-v'], cb]);
    expect(args[2]).toMatchObject({ windowsHide: true });
    expect(args[3]).toBe(cb);
  });

  it('handles execSync(cmd)', () => {
    const args = injectWindowsHideArgs(['lsof -ti:1']);
    expect(args[1]).toMatchObject({ windowsHide: true });
  });

  it('does not clobber fork IPC stdio', () => {
    const args = injectWindowsHideArgs(['./worker.js', ['--flag'], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] }]);
    expect(args[2]).toMatchObject({
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
  });
});
