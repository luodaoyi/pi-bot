/**
 * GUI 设置持久化（写入 pi-bot home/settings.json）
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWriteJson, DEFAULT_GUI_SETTINGS, type GuiSettings } from '#shared/index.js';

export class SettingsStore {
  private filePath: string;
  private settings: GuiSettings;

  constructor(homeDir: string) {
    this.filePath = join(homeDir, 'settings.json');
    this.settings = { ...DEFAULT_GUI_SETTINGS };
  }

  async load(): Promise<GuiSettings> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<GuiSettings>;
      this.settings = { ...DEFAULT_GUI_SETTINGS, ...parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.settings = { ...DEFAULT_GUI_SETTINGS };
    }
    return this.get();
  }

  get(): GuiSettings {
    return { ...this.settings };
  }

  async update(patch: Partial<GuiSettings>): Promise<GuiSettings> {
    this.settings = { ...this.settings, ...patch };
    await atomicWriteJson(this.filePath, this.settings);
    return this.get();
  }
}

export async function createSettingsStore(homeDir: string): Promise<SettingsStore> {
  const store = new SettingsStore(homeDir);
  await store.load();
  return store;
}
