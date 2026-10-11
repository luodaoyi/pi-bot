/**
 * GUI / daemon 共享的设置类型
 */
export interface GuiSettings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  memoryBackend: 'respire' | 'markdown' | 'off';
  memoryReview: boolean;
  maxSessions: number;
}

export const DEFAULT_GUI_SETTINGS: GuiSettings = {
  language: 'zh-CN',
  theme: 'light',
  memoryBackend: 'respire',
  memoryReview: false,
  maxSessions: 16,
};
