import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { mkdir } from 'fs/promises';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getPackageVersion } from './version.js';

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
    mkdirSync(dataDir, { recursive: true });
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
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(portFile, port.toString(), 'utf-8');
}

export function deletePort(): void {
  const portFile = getPortFilePath();
  if (existsSync(portFile)) {
    unlinkSync(portFile);
  }
}

export function cleanupLeftoverFiles(): void {
  const home = getPiBotHome();
  for (const name of ['state.json.tmp', 'schedules.json.tmp', 'secrets.json.tmp', 'settings.json.tmp']) {
    const leftover = join(home, name);
    if (existsSync(leftover)) {
      unlinkSync(leftover);
    }
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === 'EPERM';
  }
}

export function findPidByPort(port: number): number | null {
  try {
    const plat = platform();
    let output: string;
    
    if (plat === 'win32') {
      // Windows: Get-NetTCPConnection or netstat
      try {
        output = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess"`, { encoding: 'utf8' });
      } catch {
        output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        const match = output.match(/LISTENING\s+(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      }
    } else {
      // Unix: lsof
      output = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
    }
    
    const pid = parseInt(output.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export interface HealthResponse {
  status: string;
  version: string;
  pid: number;
  home: string;
  timestamp: string;
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

export async function getHealthInfo(port: number = DEFAULT_PORT): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    return await response.json() as HealthResponse;
  } catch {
    return null;
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
  const piBotHome = getPiBotHome();
  
  // Ensure logs directory exists
  const logsDir = join(piBotHome, 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  
  const logFile = join(logsDir, 'daemon.log');
  const { openSync } = await import('node:fs');
  const logFd = openSync(logFile, 'a');
  
  const spawnOptions: any = {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd: piBotHome,
    env: { ...process.env },
  };
  
  // Windows-specific options
  if (platform() === 'win32') {
    spawnOptions.windowsHide = true;
  }
  
  const child = spawn(process.execPath, [cliPath, 'serve', '--port', port.toString()], spawnOptions);
  
  child.unref();
  
  const pid = child.pid!;
  
  console.log(`Daemon started with PID ${pid}, logging to ${logFile}`);
  
  return { pid, port };
}

export function daemonVersionMatches(running: string | undefined, own: string): boolean {
  return Boolean(running) && running === own;
}

export function collectStopPids(input: {
  force: boolean;
  filePid: number | null;
  healthPid?: number;
  portPid?: number | null;
}): number[] {
  const ids = new Set<number>();
  if (input.filePid) ids.add(input.filePid);
  if (input.healthPid) ids.add(input.healthPid);
  if (input.force && input.portPid) ids.add(input.portPid);
  return [...ids];
}

async function killPid(pid: number): Promise<boolean> {
  if (!isProcessRunning(pid)) return false;
  try {
    process.kill(pid, 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    console.error(`Failed to kill process ${pid}`);
    return false;
  }
}

export async function stopDaemon(force: boolean = false): Promise<boolean> {
  const pid = readPid();
  const port = readPort();
  const health = await getHealthInfo(port);

  if (health) {
    try {
      const response = await fetch(`http://localhost:${port}/api/shutdown`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!(await isDaemonReachable(port))) {
          deletePid();
          deletePort();
          cleanupLeftoverFiles();
          return true;
        }
      }
    } catch {
      // HTTP shutdown unsupported on older daemons — fall through to kill
    }
  }

  const portPid = force || !health?.pid ? findPidByPort(port) : null;
  const candidates = collectStopPids({
    force: force || !health?.pid,
    filePid: pid,
    healthPid: health?.pid,
    portPid,
  });

  if (candidates.length === 0) {
    if (!health && !pid) return false;
    deletePid();
    deletePort();
    cleanupLeftoverFiles();
    return Boolean(health);
  }

  let killed = false;
  for (const candidate of candidates) {
    killed = (await killPid(candidate)) || killed;
  }

  deletePid();
  deletePort();
  cleanupLeftoverFiles();
  return killed || Boolean(health);
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
  deletePort();
  return { running: false, port };
}

export async function ensureDaemon(port: number = DEFAULT_PORT): Promise<{ pid: number; port: number; started: boolean }> {
  const ownVersion = getPackageVersion();
  const health = await getHealthInfo(port);
  let forcedRestart = false;
  if (health) {
    const legacy = !health.pid;
    const mismatch = !daemonVersionMatches(health.version, ownVersion);
    if (legacy || mismatch) {
      console.log(
        `Found ${legacy ? 'legacy ' : ''}daemon on port ${port} (version: ${health.version || 'unknown'}, wanted: ${ownVersion}). Stopping and restarting...`
      );
      await stopDaemon(true);
      forcedRestart = true;
    } else {
      return { pid: health.pid, port, started: false };
    }
  }
  
  const status = await getDaemonStatus();
  if (!forcedRestart && status.running && status.pid) {
    return { pid: status.pid, port: status.port, started: false };
  }
  
  const result = await startDaemon(port);
  const success = await waitForDaemon(port, 30000);
  
  if (!success) {
    throw new Error('Failed to start daemon: health check timeout after 30s');
  }
  
  const newHealth = await getHealthInfo(port);
  if (newHealth && newHealth.pid !== result.pid) {
    console.warn(`Warning: Started daemon with PID ${result.pid} but health check reports PID ${newHealth.pid}`);
    console.warn(`Another daemon may have bound to port ${port} first`);
  }
  if (newHealth && !daemonVersionMatches(newHealth.version, ownVersion)) {
    throw new Error(
      `Daemon still reports version ${newHealth.version || 'unknown'} after restart (wanted ${ownVersion}). Run 'pi-bot stop --force'.`
    );
  }
  
  return { ...result, started: true };
}
