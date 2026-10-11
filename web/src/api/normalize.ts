import type { Bot, ModelInfo, Settings } from '@/types';
import type {
  BotSseEvent,
  ContractSettings,
  ModelRef,
  PiModel,
  SessionStats,
  ThinkingLevel,
} from './types';
import { emptySessionStats, THINKING_LEVELS } from './types';

const THINKING_SET = new Set<string>(THINKING_LEVELS);

export function toModelRef(raw: unknown): ModelRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const provider = String(rec.provider ?? '');
  const id = String(rec.id ?? rec.modelId ?? '');
  if (!provider && !id) return null;
  return { provider, id };
}

export function toPiModel(raw: unknown): PiModel {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const id = String(rec.id ?? rec.modelId ?? '');
  const input = Array.isArray(rec.input) ? rec.input.map(String) : [];
  return {
    provider: String(rec.provider ?? ''),
    id,
    name: String(rec.name ?? rec.modelId ?? rec.id ?? id),
    contextWindow: Number(rec.contextWindow ?? 0),
    reasoning: Boolean(rec.reasoning ?? rec.supportsThinking),
    input,
    hasAuth: rec.hasAuth === undefined ? true : Boolean(rec.hasAuth),
  };
}

export function toThinking(raw: unknown): ThinkingLevel | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = String(raw);
  return THINKING_SET.has(value) ? (value as ThinkingLevel) : null;
}

export function normalizeBot(raw: unknown): Bot {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const model = rec.model === null ? null : toModelRef(rec.model);
  return {
    id: String(rec.id ?? ''),
    name: String(rec.name ?? ''),
    role: String(rec.role ?? ''),
    instructions: String(rec.instructions ?? ''),
    model,
    thinking: toThinking(rec.thinking),
    look: rec.look as Bot['look'],
    isMain: Boolean(rec.isMain),
    created: String(rec.created ?? rec.createdAt ?? ''),
    segments: Array.isArray(rec.segments) ? rec.segments.map(String) : [],
  };
}

export function botModelPayload(model: ModelRef | null | undefined): Record<string, unknown> | null {
  if (!model) return null;
  return { provider: model.provider, id: model.id, modelId: model.id };
}

export function normalizeSettings(raw: unknown): Settings {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const language = rec.language === 'en-US' ? 'en-US' : 'zh-CN';
  const theme = rec.theme === 'dark' || rec.theme === 'auto' || rec.theme === 'light' ? rec.theme : 'auto';
  const memoryBackend =
    rec.memoryBackend === 'markdown' || rec.memoryBackend === 'off' || rec.memoryBackend === 'respire'
      ? rec.memoryBackend
      : 'respire';
  return {
    language,
    theme,
    memoryBackend,
    memoryReview: Boolean(rec.memoryReview),
    maxSessions: Number(rec.maxSessions ?? 16) || 16,
    idleTimeoutMinutes: Number(rec.idleTimeoutMinutes ?? 10) || 10,
    defaultModel: toModelRef(rec.defaultModel),
    defaultThinking: toThinking(rec.defaultThinking),
    loadUserExtensions: Boolean(rec.loadUserExtensions),
    loadContextFiles: Boolean(rec.loadContextFiles),
    timezone: String(rec.timezone || 'UTC'),
    workdir: String(rec.workdir ?? ''),
  };
}

export function settingsToContract(settings: Settings): ContractSettings {
  return { ...settings };
}

export function toModelInfo(model: PiModel): ModelInfo {
  return {
    id: model.id,
    provider: model.provider,
    name: model.name,
    contextWindow: model.contextWindow,
    supportsVision: model.input.includes('image'),
    supportsThinking: model.reasoning,
    reasoning: model.reasoning,
    input: model.input,
    hasAuth: model.hasAuth,
  };
}

export function normalizeStats(raw: unknown): SessionStats {
  if (!raw || typeof raw !== 'object') return emptySessionStats();
  const rec = raw as Record<string, unknown>;
  const tokens = (rec.tokens && typeof rec.tokens === 'object' ? rec.tokens : rec) as Record<string, unknown>;
  const usage = rec.contextUsage && typeof rec.contextUsage === 'object'
    ? (rec.contextUsage as Record<string, unknown>)
    : null;
  const input = Number(tokens.input ?? tokens.inputTokens ?? 0);
  const output = Number(tokens.output ?? tokens.outputTokens ?? 0);
  const cacheRead = Number(tokens.cacheRead ?? tokens.cacheReadTokens ?? 0);
  const cacheWrite = Number(tokens.cacheWrite ?? tokens.cacheWriteTokens ?? 0);
  return {
    tokens: {
      input,
      output,
      cacheRead,
      cacheWrite,
      total: Number(tokens.total ?? input + output + cacheRead + cacheWrite),
    },
    cost: Number(rec.cost ?? 0),
    contextUsage: usage
      ? {
          tokens: Number(usage.tokens ?? 0),
          contextWindow: Number(usage.contextWindow ?? 0),
          percent: Number(usage.percent ?? 0),
        }
      : null,
  };
}

export function isNotImplemented(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 405;
}

const LEGACY_TYPE_MAP: Record<string, BotSseEvent['type']> = {
  message_start: 'bot.message_start',
  text_delta: 'bot.text_delta',
  delta: 'bot.text_delta',
  thinking_delta: 'bot.thinking_delta',
  tool_start: 'bot.tool_start',
  tool_update: 'bot.tool_update',
  tool_end: 'bot.tool_end',
  message_end: 'bot.message_end',
  done: 'bot.turn_end',
  agent_settled: 'bot.turn_end',
  error: 'bot.error',
  stats: 'bot.stats',
};

export function normalizeSseEvent(raw: unknown): BotSseEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const rawType = String(rec.type ?? '');
  if (!rawType || rawType === 'system' || rawType === 'heartbeat' || rawType === 'connected') {
    return null;
  }
  const type = rawType.startsWith('bot.') ? rawType : (LEGACY_TYPE_MAP[rawType] ?? rawType);
  return {
    ...rec,
    type,
    botId: rec.botId as string | undefined,
    sessionId: rec.sessionId as string | undefined,
    runId: rec.runId as string | undefined,
    toolCallId: rec.toolCallId as string | undefined,
    toolName: rec.toolName as string | undefined,
    args: rec.args as Record<string, unknown> | undefined,
    result: rec.result,
    isError: rec.isError as boolean | undefined,
    delta: (rec.delta ?? rec.text ?? rec.content) as string | undefined,
    text: rec.text as string | undefined,
    content: rec.content as string | undefined,
    error: (rec.error ?? rec.message) as string | undefined,
    message: rec.message as string | undefined,
    stats: rec.stats ? normalizeStats(rec.stats) : undefined,
    messageId: rec.messageId as string | undefined,
  };
}

export function stringifyUnknown(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
