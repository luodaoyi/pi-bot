import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  port: number;
}

const DEFAULT_PORT = 8787;

export function getPiBotHome(): string {
  return process.env.PI_BOT_HOME || join(homedir(), '.pi-bot');
}

export function getPidFilePath(): string {
  return join(getPiBotHome(), 'daemon.pid');
}

export function getPortFilePath(): string {
  return join(getPiBotHome(), 'daemon.port');
}

export async function ensureDataDir(): Promise<void> {
  const dataDir = getPiBotHome();
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }
}

export function readPid(): number | null {
  const pidFile = getPidFilePath();
  if (!existsSync(pidFile)) {
    return null;
  }
  try {
    const content = readFileSync(pidFile, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function writePid(pid: number): void {
  const dataDir = getPiBotHome();
  const pidFile = getPidFilePath();
  if (!existsSync(dataDir)) {
    require('fs').mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(pidFile, pid.toString(), 'utf-8');
}

export function deletePid(): void {
  const pidFile = getPidFilePath();
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
}

export function readPort(): number {
  const portFile = getPortFilePath();
  if (!existsSync(portFile)) {
    return DEFAULT_PORT;
  }
  try {
    const content = readFileSync(portFile, 'utf-8').trim();
    const port = parseInt(content, 10);
    return isNaN(port) ? DEFAULT_PORT : port;
  } catch {
    return DEFAULT_PORT;
  }
}

export function writePort(port: number): void {
  const dataDir = getPiBotHome();
  const portFile = getPortFilePath();
  if (!existsSync(dataDir)) {
    require('fs').mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(portFile, port.toString(), 'utf-8');
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === 'EPERM';
  }
}

export async function isDaemonReachable(port: number = DEFAULT_PORT): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForDaemon(port: number = DEFAULT_PORT, timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isDaemonReachable(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

export function getCliPath(): string {
  const modulePath = fileURLToPath(import.meta.url);
  const rootDir = join(dirname(modulePath), '..', '..');
  return join(rootDir, 'dist', 'cli.js');
}

export function openUrl(url: string): void {
  const cmd = platform() === 'win32' ? 'cmd' : platform() === 'darwin' ? 'open' : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '""', url] : [url];
  
  spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

export async function startDaemon(port: number = DEFAULT_PORT): Promise<{ pid: number; port: number }> {
  await ensureDataDir();
  
  const cliPath = getCliPath();
  
  const child = spawn(process.execPath, [cliPath, 'serve', '--port', port.toString()], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  
  child.unref();
  
  const pid = child.pid!;
  
  return { pid, port };
}

export async function stopDaemon(): Promise<boolean> {
  const pid = readPid();
  const port = readPort();
  
  if (!pid) {
    return false;
  }
  
  try {
    const response = await fetch(`http://localhost:${port}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      deletePid();
      return true;
    }
  } catch {
    // Ignore fetch errors, fall through to process kill
  }
  
  if (isProcessRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      if (isProcessRunning(pid)) {
        process.kill(pid, 'SIGKILL');
      }
      
      deletePid();
      return true;
    } catch {
      return false;
    }
  }
  
  deletePid();
  return false;
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
  const pid = readPid();
  const port = readPort();
  
  if (!pid) {
    return { running: false, port };
  }
  
  const processRunning = isProcessRunning(pid);
  const reachable = await isDaemonReachable(port);
  
  if (reachable) {
    return { running: true, pid, port };
  }
  
  if (processRunning) {
    return { running: true, pid, port };
  }
  
  deletePid();
  return { running: false, port };
}

export async function ensureDaemon(port: number = DEFAULT_PORT): Promise<{ pid: number; port: number; started: boolean }> {
  const status = await getDaemonStatus();
  
  if (status.running && status.pid) {
    return { pid: status.pid, port: status.port, started: false };
  }
  
  const result = await startDaemon(port);
  const success = await waitForDaemon(port, 30000);
  
  if (!success) {
    throw new Error('Failed to start daemon: health check timeout after 30s');
  }
  
  return { ...result, started: true };
}
