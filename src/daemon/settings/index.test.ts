import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSettingsStore } from './index.js';

describe('SettingsStore', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'pi-bot-settings-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns contract defaults including defaultModel null (follow pi)', async () => {
    const store = await createSettingsStore(tmp);
    const settings = store.get();
    expect(settings.defaultModel).toBeNull();
    expect(settings.defaultThinking).toBeNull();
    expect(settings.idleTimeoutMinutes).toBe(10);
    expect(settings.loadUserExtensions).toBe(false);
    expect(settings.loadContextFiles).toBe(false);
    expect(settings.workdir).toBe(join(tmp, 'workspace'));
    expect(settings.timezone).toBeTruthy();
  });

  it('persists defaultModel null and a concrete model', async () => {
    const store = await createSettingsStore(tmp);
    await store.update({ defaultModel: { provider: 'anthropic', id: 'claude-sonnet-4-6' } });
    expect(store.get().defaultModel).toEqual({ provider: 'anthropic', id: 'claude-sonnet-4-6' });

    await store.update({ defaultModel: null });
    expect(store.get().defaultModel).toBeNull();

    const raw = JSON.parse(await readFile(join(tmp, 'settings.json'), 'utf-8')) as { defaultModel: null };
    expect(raw.defaultModel).toBeNull();
  });

  it('accepts modelId alias when writing defaultModel', async () => {
    const store = await createSettingsStore(tmp);
    await store.update({
      defaultModel: { provider: 'openai', modelId: 'gpt-5' } as never,
    });
    expect(store.get().defaultModel).toEqual({ provider: 'openai', id: 'gpt-5' });
  });

  it('loads legacy settings.json without new fields', async () => {
    await writeFile(
      join(tmp, 'settings.json'),
      JSON.stringify({ language: 'en-US', theme: 'dark', memoryBackend: 'off', memoryReview: true, maxSessions: 4 })
    );
    const store = await createSettingsStore(tmp);
    expect(store.get().language).toBe('en-US');
    expect(store.get().defaultModel).toBeNull();
    expect(store.get().maxSessions).toBe(4);
    expect(store.get().idleTimeoutMinutes).toBe(10);
  });
});
