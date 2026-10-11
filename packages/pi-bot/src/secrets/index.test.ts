import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSecretsManager } from './index.js';

describe('SecretsManager', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pi-bot-secrets-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create and list secrets', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    await secrets.approveSecret(
      'API_KEY',
      { name: 'API_KEY', value: 'secret-value-123', scope: 'all' },
      'bot-123'
    );

    const list = await secrets.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('API_KEY');
    expect(list[0].scope).toBe('all');
    // Value should not be in list
    expect((list[0] as any).value).toBeUndefined();
  });

  it('should get secret value for authorized bot', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    await secrets.approveSecret(
      'API_KEY',
      { name: 'API_KEY', value: 'secret-value-123', scope: ['bot-1'] },
      'bot-1'
    );

    const value1 = await secrets.getValue('API_KEY', 'bot-1');
    expect(value1).toBe('secret-value-123');

    const value2 = await secrets.getValue('API_KEY', 'bot-2');
    expect(value2).toBeNull();
  });

  it('should mask secrets in text', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    await secrets.approveSecret(
      'API_KEY',
      { name: 'API_KEY', value: 'sk-1234567890abcdef', scope: 'all' },
      'bot-1'
    );

    const text = 'The API key is sk-1234567890abcdef and should be masked';
    const masked = secrets.maskSecrets(text);

    expect(masked).not.toContain('sk-1234567890abcdef');
    expect(masked).toContain('[secret:API_KEY]');
  });

  it('should detect secret-like strings', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    // API keys
    expect(secrets.looksLikeSecret('sk-proj-abc123')).toBe(true);
    expect(secrets.looksLikeSecret('ghp_1234567890123456789012345678901234567')).toBe(true);

    // Passwords
    expect(secrets.looksLikeSecret('密码是abc123')).toBe(true);
    expect(secrets.looksLikeSecret('password is secret123')).toBe(true);

    // Normal text
    expect(secrets.looksLikeSecret('Hello world')).toBe(false);
    expect(secrets.looksLikeSecret('Some normal description')).toBe(false);
  });

  it('should filter secrets by bot scope', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    await secrets.approveSecret(
      'SECRET_1',
      { name: 'SECRET_1', value: 'value1', scope: 'all' },
      'bot-1'
    );

    await secrets.approveSecret(
      'SECRET_2',
      { name: 'SECRET_2', value: 'value2', scope: ['bot-2'] },
      'bot-2'
    );

    const bot1List = await secrets.list('bot-1');
    expect(bot1List).toHaveLength(1);
    expect(bot1List[0].name).toBe('SECRET_1');

    const bot2List = await secrets.list('bot-2');
    expect(bot2List).toHaveLength(2);
  });

  it('should get all values for a bot', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    await secrets.approveSecret(
      'KEY_1',
      { name: 'KEY_1', value: 'value1', scope: 'all' },
      'bot-1'
    );

    await secrets.approveSecret(
      'KEY_2',
      { name: 'KEY_2', value: 'value2', scope: ['bot-1'] },
      'bot-1'
    );

    const values = await secrets.getValuesForBot('bot-1');
    expect(values).toEqual({
      KEY_1: 'value1',
      KEY_2: 'value2',
    });
  });

  it('should delete secret', async () => {
    const secrets = await createSecretsManager({
      storePath: join(tempDir, 'secrets.json'),
    });

    await secrets.approveSecret(
      'API_KEY',
      { name: 'API_KEY', value: 'secret-value', scope: 'all' },
      'bot-1'
    );

    await secrets.delete('API_KEY');

    const list = await secrets.list();
    expect(list).toHaveLength(0);
  });
});
