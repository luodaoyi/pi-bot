/**
 * GUI / daemon 共享的设置类型（持久化在 pi-bot home，不写 pi settings.json）
 */
export const THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type ThinkingLevelSetting = (typeof THINKING_LEVELS)[number];

export interface SettingsModelRef {
  provider: string;
  id: string;
}

export interface GuiSettings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  memoryBackend: 'respire' | 'markdown' | 'off';
  memoryReview: boolean;
  maxSessions: number;
  idleTimeoutMinutes: number;
  /** null = 跟随 pi ~/.pi/agent/settings.json */
  defaultModel: SettingsModelRef | null;
  defaultThinking: ThinkingLevelSetting | null;
  loadUserExtensions: boolean;
  loadContextFiles: boolean;
  timezone: string;
  workdir: string;
}

export const DEFAULT_GUI_SETTINGS: GuiSettings = {
  language: 'zh-CN',
  theme: 'light',
  memoryBackend: 'respire',
  memoryReview: false,
  maxSessions: 16,
  idleTimeoutMinutes: 10,
  defaultModel: null,
  defaultThinking: null,
  loadUserExtensions: false,
  loadContextFiles: false,
  timezone: 'UTC',
  workdir: '',
};

export function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
