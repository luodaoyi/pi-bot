import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { mkdir } from 'fs/promises';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { spawn, execSync } from 'child_process';
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

export async function stopDaemon(force: boolean = false): Promise<boolean> {
  const pid = readPid();
  const port = readPort();
  
  // Try to stop via HTTP first (works even without PID file)
  const health = await getHealthInfo(port);
  if (health) {
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
      // Ignore fetch errors, fall through
    }
    
    // If health exists but no PID (legacy daemon), try to find PID by port
    if (!health.pid && force) {
      console.log(`Legacy daemon detected, finding PID by port ${port}...`);
      const portPid = findPidByPort(port);
      if (portPid && isProcessRunning(portPid)) {
        console.log(`Found PID ${portPid} on port ${port}, stopping...`);
        try {
          process.kill(portPid, 'SIGTERM');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          if (isProcessRunning(portPid)) {
            process.kill(portPid, 'SIGKILL');
          }
          
          deletePid();
          return true;
        } catch {
          console.error(`Failed to kill process ${portPid}`);
        }
      }
    }
  }
  
  // If no PID file and daemon not reachable, nothing to stop
  if (!pid) {
    return false;
  }
  
  // Try to kill by PID
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
      deletePid();
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
  // Check if a daemon is already running on this port
  const health = await getHealthInfo(port);
  if (health) {
    const localPid = readPid();
    
    // Check if health has PID (beta.4+) or is legacy (beta.0-3)
    if (!health.pid) {
      console.error(`Error: Found legacy daemon on port ${port} (version: ${health.version || 'unknown'})`);
      console.error(`This daemon does not report its PID (pre-beta.4).`);
      console.error(`Run 'pi-bot stop --force' to stop it, then try again.`);
      throw new Error(`Legacy daemon on port ${port} - use 'pi-bot stop --force'`);
    }
    
    if (localPid && health.pid === localPid) {
      // Same daemon, all good
      return { pid: health.pid, port, started: false };
    } else {
      // Different daemon (or no PID file)
      console.error(`Error: Found existing daemon on port ${port} (PID: ${health.pid}, version: ${health.version})`);
      console.error(`Expected PID: ${localPid || 'none'}`);
      console.error(`Run 'pi-bot stop --force' to stop the existing daemon first`);
      throw new Error(`Existing daemon on port ${port} - use 'pi-bot stop --force'`);
    }
  }
  
  const status = await getDaemonStatus();
  if (status.running && status.pid) {
    return { pid: status.pid, port: status.port, started: false };
  }
  
  const result = await startDaemon(port);
  const success = await waitForDaemon(port, 30000);
  
  if (!success) {
    throw new Error('Failed to start daemon: health check timeout after 30s');
  }
  
  // Verify the responding daemon
  const newHealth = await getHealthInfo(port);
  if (newHealth && newHealth.pid !== result.pid) {
    console.warn(`Warning: Started daemon with PID ${result.pid} but health check reports PID ${newHealth.pid}`);
    console.warn(`Another daemon may have bound to port ${port} first`);
  }
  
  return { ...result, started: true };
}
