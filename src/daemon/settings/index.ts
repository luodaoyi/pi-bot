/**
 * GUI 设置持久化（写入 pi-bot home/settings.json）
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  atomicWriteJson,
  DEFAULT_GUI_SETTINGS,
  defaultTimezone,
  THINKING_LEVELS,
  type GuiSettings,
  type SettingsModelRef,
  type ThinkingLevelSetting,
} from '#shared/index.js';

const LANGUAGES = new Set(['zh-CN', 'en-US']);
const THEMES = new Set(['light', 'dark', 'auto']);
const MEMORY_BACKENDS = new Set(['respire', 'markdown', 'off']);
const THINKING = new Set<string>(THINKING_LEVELS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDefaultModel(value: unknown): SettingsModelRef | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    throw new Error('defaultModel must be {provider,id} or null');
  }
  const provider = value['provider'];
  const id = value['id'] ?? value['modelId'];
  if (typeof provider !== 'string' || !provider.trim() || typeof id !== 'string' || !id.trim()) {
    throw new Error('defaultModel must be {provider,id} or null');
  }
  return { provider: provider.trim(), id: id.trim() };
}

function normalizeThinking(value: unknown): ThinkingLevelSetting | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !THINKING.has(value)) {
    throw new Error(`defaultThinking must be one of ${THINKING_LEVELS.join(', ')} or null`);
  }
  return value as ThinkingLevelSetting;
}

export function createDefaultSettings(homeDir: string): GuiSettings {
  return {
    ...DEFAULT_GUI_SETTINGS,
    timezone: defaultTimezone(),
    workdir: join(homeDir, 'workspace'),
  };
}

export class SettingsStore {
  private filePath: string;
  private settings: GuiSettings;
  private readonly defaults: GuiSettings;

  constructor(homeDir: string) {
    this.filePath = join(homeDir, 'settings.json');
    this.defaults = createDefaultSettings(homeDir);
    this.settings = { ...this.defaults };
  }

  async load(): Promise<GuiSettings> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<GuiSettings>;
      let defaultModel = this.defaults.defaultModel;
      if ('defaultModel' in parsed) {
        try {
          defaultModel = normalizeDefaultModel(parsed.defaultModel);
        } catch {
          defaultModel = null;
        }
      }
      this.settings = {
        ...this.defaults,
        ...parsed,
        defaultModel,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.settings = { ...this.defaults };
    }
    return this.get();
  }

  get(): GuiSettings {
    return { ...this.settings, defaultModel: this.settings.defaultModel };
  }

  async update(patch: Partial<GuiSettings>): Promise<GuiSettings> {
    if (!isRecord(patch)) {
      throw new Error('Settings patch must be an object');
    }

    const next: GuiSettings = { ...this.settings };

    if (patch.language !== undefined) {
      if (!LANGUAGES.has(patch.language)) throw new Error('Invalid language');
      next.language = patch.language;
    }
    if (patch.theme !== undefined) {
      if (!THEMES.has(patch.theme)) throw new Error('Invalid theme');
      next.theme = patch.theme;
    }
    if (patch.memoryBackend !== undefined) {
      if (!MEMORY_BACKENDS.has(patch.memoryBackend)) throw new Error('Invalid memoryBackend');
      next.memoryBackend = patch.memoryBackend;
    }
    if (patch.memoryReview !== undefined) {
      if (typeof patch.memoryReview !== 'boolean') throw new Error('memoryReview must be boolean');
      next.memoryReview = patch.memoryReview;
    }
    if (patch.maxSessions !== undefined) {
      if (!Number.isFinite(patch.maxSessions) || patch.maxSessions < 1) {
        throw new Error('maxSessions must be a positive number');
      }
      next.maxSessions = Math.floor(patch.maxSessions);
    }
    if (patch.idleTimeoutMinutes !== undefined) {
      if (!Number.isFinite(patch.idleTimeoutMinutes) || patch.idleTimeoutMinutes < 1) {
        throw new Error('idleTimeoutMinutes must be a positive number');
      }
      next.idleTimeoutMinutes = Math.floor(patch.idleTimeoutMinutes);
    }
    if ('defaultModel' in patch) {
      next.defaultModel = normalizeDefaultModel(patch.defaultModel);
    }
    if ('defaultThinking' in patch) {
      next.defaultThinking = normalizeThinking(patch.defaultThinking);
    }
    if (patch.loadUserExtensions !== undefined) {
      if (typeof patch.loadUserExtensions !== 'boolean') {
        throw new Error('loadUserExtensions must be boolean');
      }
      next.loadUserExtensions = patch.loadUserExtensions;
    }
    if (patch.loadContextFiles !== undefined) {
      if (typeof patch.loadContextFiles !== 'boolean') {
        throw new Error('loadContextFiles must be boolean');
      }
      next.loadContextFiles = patch.loadContextFiles;
    }
    if (patch.timezone !== undefined) {
      if (typeof patch.timezone !== 'string' || !patch.timezone.trim()) {
        throw new Error('timezone must be a non-empty string');
      }
      next.timezone = patch.timezone.trim();
    }
    if (patch.workdir !== undefined) {
      if (typeof patch.workdir !== 'string' || !patch.workdir.trim()) {
        throw new Error('workdir must be a non-empty string');
      }
      next.workdir = patch.workdir.trim();
    }

    this.settings = next;
    await atomicWriteJson(this.filePath, this.settings);
    return this.get();
  }
}

export async function createSettingsStore(homeDir: string): Promise<SettingsStore> {
  const store = new SettingsStore(homeDir);
  await store.load();
  return store;
}
