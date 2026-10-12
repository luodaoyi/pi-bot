/**
 * pi-bot 自管理工具的上下文与结果类型
 */

import type { BotConfig } from '#shared/index.js';
import type { Store } from '../store/index.js';
import type { SessionPool } from '../sessions/index.js';
import type { Scheduler } from '../scheduler/index.js';
import type { GroupManager } from '../groups/index.js';
import type { SecretsManager } from '../secrets/index.js';

/** 与 DeepSeek-Bot 对齐的消息跳数上限，防止 bot 互相呼叫死循环 */
export const MAX_HOPS = 6;

export const DEFAULT_ASK_TIMEOUT_MS = 90_000;

export interface PibotToolContext {
  store: Store;
  pool: SessionPool;
  scheduler: Scheduler;
  groups: GroupManager;
  secrets: SecretsManager;
  getTimezone: () => string;
  currentBotId: string;
  currentSessionId: string;
  currentHop: number;
}

export interface PibotToolResult {
  text: string;
  details?: unknown;
  isError?: boolean;
}

export interface PibotHost {
  store: Store;
  pool: SessionPool;
  scheduler: Scheduler;
  groups: GroupManager;
  secrets: SecretsManager;
  getTimezone: () => string;
}

export function toolOk(text: string, details?: unknown): PibotToolResult {
  return { text, details };
}

export function toolErr(text: string, details?: unknown): PibotToolResult {
  return { text, details, isError: true };
}

export async function resolveBot(
  store: Store,
  ref: string | undefined,
  fallbackId?: string
): Promise<BotConfig> {
  const bots = await store.listBots();
  if (!ref || !ref.trim()) {
    const fallback = fallbackId ? bots.find((b) => b.id === fallbackId) : undefined;
    if (!fallback) {
      throw new Error('未指定 bot，且当前会话没有可用的 bot');
    }
    return fallback;
  }
  const key = ref.trim();
  const byId = bots.find((b) => b.id === key);
  if (byId) return byId;
  const exact = bots.find((b) => b.name === key);
  if (exact) return exact;
  const lower = key.toLowerCase();
  const fuzzy = bots.find((b) => b.name.toLowerCase() === lower);
  if (fuzzy) return fuzzy;
  const names = bots.map((b) => `${b.name} (${b.id})`).join(', ') || '(none)';
  throw new Error(`找不到 bot「${key}」。当前团队：${names}`);
}

export function parseModelRef(raw: string | undefined): { provider: string; id: string } | undefined {
  if (!raw || !raw.trim()) return undefined;
  const text = raw.trim();
  const slash = text.indexOf('/');
  if (slash <= 0 || slash === text.length - 1) {
    throw new Error(`model 须为 provider/id，例如 deepseek/deepseek-chat，收到：${text}`);
  }
  return { provider: text.slice(0, slash), id: text.slice(slash + 1) };
}
