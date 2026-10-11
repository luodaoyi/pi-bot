import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import {
  getPiBotHome,
  getPidFilePath,
  getPortFilePath,
  readPid,
  writePid,
  deletePid,
  readPort,
  writePort,
  deletePort,
  isProcessRunning,
} from '../daemon-manager.js';

describe('daemon-manager', () => {
  beforeEach(() => {
    if (existsSync(getPidFilePath())) {
      unlinkSync(getPidFilePath());
    }
    if (existsSync(getPortFilePath())) {
      unlinkSync(getPortFilePath());
    }
  });

  afterEach(() => {
    if (existsSync(getPidFilePath())) {
      unlinkSync(getPidFilePath());
    }
    if (existsSync(getPortFilePath())) {
      unlinkSync(getPortFilePath());
    }
  });

  it('should get pi-bot home directory', () => {
    const home = getPiBotHome();
    expect(home).toBeTruthy();
    expect(home).toContain('.pi-bot');
  });

  it('should write and read PID', async () => {
    const testPid = 12345;
    writePid(testPid);
    
    const readBack = readPid();
    expect(readBack).toBe(testPid);
  });

  it('should delete PID file', async () => {
    writePid(12345);
    expect(existsSync(getPidFilePath())).toBe(true);
    
    deletePid();
    expect(existsSync(getPidFilePath())).toBe(false);
  });

  it('should write and read port', () => {
    const testPort = 9999;
    writePort(testPort);
    
    const readBack = readPort();
    expect(readBack).toBe(testPort);
  });

  it('should delete port file', () => {
    writePort(9999);
    expect(existsSync(getPortFilePath())).toBe(true);
    deletePort();
    expect(existsSync(getPortFilePath())).toBe(false);
  });

  it('should check if current process is running', () => {
    const running = isProcessRunning(process.pid);
    expect(running).toBe(true);
  });

  it('should detect non-existent process', () => {
    const running = isProcessRunning(999999);
    expect(running).toBe(false);
  });

  it('should return null for non-existent PID file', () => {
    const pid = readPid();
    expect(pid).toBeNull();
  });

  it('should return default port when port file does not exist', () => {
    const port = readPort();
    expect(port).toBe(8787);
  });
});
