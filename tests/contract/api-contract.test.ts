/**
 * API Contract Test
 * Tests that the daemon API and web client are compatible
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { HttpApiClient } from '../../web/src/api/http.js';

describe('API Contract Tests', () => {
  let daemonProcess: ChildProcess;
  let apiClient: HttpApiClient;
  const TEST_PORT = 8788;

  beforeAll(async () => {
    // Start daemon with test config
    daemonProcess = spawn('node', ['dist/cli.js', 'serve', '--dev'], {
      env: {
        ...process.env,
        PIBOT_LISTEN: `127.0.0.1:${TEST_PORT}`,
        PIBOT_HOME: '/tmp/pi-bot-test-contract',
        PI_MODEL: 'mock',
      },
      stdio: 'pipe',
    });

    // Wait for daemon to start
    await new Promise((resolve) => {
      daemonProcess.stdout?.on('data', (data: Buffer) => {
        if (data.toString().includes('Server running')) {
          resolve(true);
        }
      });
      setTimeout(resolve, 5000);
    });

    apiClient = new HttpApiClient(`http://127.0.0.1:${TEST_PORT}/api`);
  });

  afterAll(async () => {
    daemonProcess?.kill();
    // Wait for process to exit
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  describe('Bot endpoints', () => {
    it('should list bots and return array', async () => {
      const bots = await apiClient.getBots();
      expect(Array.isArray(bots)).toBe(true);
    });

    it('should create bot and return bot object', async () => {
      const bot = await apiClient.createBot({
        name: 'Test Bot',
        role: 'tester',
        instructions: 'Test instructions',
        model: 'mock',
      });
      expect(bot).toBeDefined();
      expect(bot.id).toBeDefined();
      expect(bot.name).toBe('Test Bot');
    });

    it('should get bot by id', async () => {
      const bots = await apiClient.getBots();
      if (bots.length > 0) {
        const bot = await apiClient.getBot(bots[0].id);
        expect(bot).toBeDefined();
        expect(bot.id).toBe(bots[0].id);
      }
    });
  });

  describe('Group endpoints', () => {
    it('should list groups and return array', async () => {
      const groups = await apiClient.getGroups();
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('Task endpoints', () => {
    it('should list tasks and return array', async () => {
      const tasks = await apiClient.getTasks();
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Secret endpoints', () => {
    it('should list secrets and return array', async () => {
      const secrets = await apiClient.getSecrets();
      expect(Array.isArray(secrets)).toBe(true);
    });
  });

  describe('System endpoints', () => {
    it('should get available models and return array', async () => {
      const models = await apiClient.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should throw ApiError for non-existent bot', async () => {
      await expect(apiClient.getBot('non-existent-id')).rejects.toThrow();
    });

    it('should throw ApiError for non-existent group', async () => {
      await expect(apiClient.getGroup('non-existent-id')).rejects.toThrow();
    });
  });
});
