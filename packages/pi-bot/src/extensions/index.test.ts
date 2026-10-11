import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScheduler } from '../scheduler/index.js';
import { createSecretsManager } from '../secrets/index.js';
import { createUsageTracker } from '../usage/index.js';
import { createFeatureExtensions } from './index.js';

describe('Feature Extensions', () => {
  let tempDir: string;
  const botId = 'test-bot-123';
  const sessionId = 'test-session-456';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pi-bot-extensions-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create feature extensions with all dependencies', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    const features = createFeatureExtensions({
      scheduler,
      secrets,
      usage,
      getCurrentBotId: () => botId,
      getSessionId: () => sessionId,
      getCwd: () => tempDir,
    });

    expect(features.extensions).toHaveLength(3);
    expect(features.createBashToolWithSecrets).toBeDefined();
    expect(typeof features.createBashToolWithSecrets).toBe('function');

    await scheduler.shutdown();
    await usage.shutdown();
  });

  it('should provide scheduler extension factory', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    const features = createFeatureExtensions({
      scheduler,
      secrets,
      usage,
      getCurrentBotId: () => botId,
      getSessionId: () => sessionId,
      getCwd: () => tempDir,
      getSecretsSync: () => ({}),
    });

    // Verify extensions are functions
    expect(typeof features.extensions[0]).toBe('function');
    expect(typeof features.extensions[1]).toBe('function');
    expect(typeof features.extensions[2]).toBe('function');

    await scheduler.shutdown();
    await usage.shutdown();
  });

  it('should provide bash tool factory', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    // Add a test secret
    await secrets.approveSecret(
      'TEST_KEY',
      { name: 'TEST_KEY', value: 'secret-value', scope: 'all' },
      botId
    );

    const features = createFeatureExtensions({
      scheduler,
      secrets,
      usage,
      getCurrentBotId: () => botId,
      getSessionId: () => sessionId,
      getCwd: () => tempDir,
      getSecretsSync: () => ({ TEST_KEY: 'secret-value' }),
    });

    // Verify the factory is provided
    expect(features.createBashToolWithSecrets).toBeDefined();
    expect(typeof features.createBashToolWithSecrets).toBe('function');

    await scheduler.shutdown();
    await usage.shutdown();
  });

  it('should handle secret request callback', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

        let _requestReceived = false;
        let _requestName = '';
        let _requestPurpose = '';

    const features = createFeatureExtensions({
      scheduler,
      secrets,
      usage,
      getCurrentBotId: () => botId,
      getSessionId: () => sessionId,
      getCwd: () => tempDir,
      getSecretsSync: () => ({}),
      onSecretRequest: (name, purpose, _id) => {
        _requestReceived = true;
        _requestName = name;
        _requestPurpose = purpose;
      },
    });

    expect(features.extensions).toBeDefined();
    // Note: Can't fully test the callback without a real pi session
    // The callback is passed through to the extension

    await scheduler.shutdown();
    await usage.shutdown();
  });
});
