/**
 * Resolve a bot's model preference to a pi-ai Model object.
 *
 * Single resolver for the daemon: talks to C's ModelRuntime / SettingsManager
 * (or the same SDK types injected in tests). Do not pass strings or
 * `{provider,modelId}` into the SDK — it needs a real Model.
 */

import type { Model } from '@earendil-works/pi-ai';
import type { ModelRuntime, SettingsManager } from '@earendil-works/pi-coding-agent';
import type { BotModel, ModelRef, ThinkingLevel } from '#shared/index.js';

export const THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const satisfies readonly ThinkingLevel[];

/** C's ModelRuntime (and test doubles) — one catalog / auth surface. */
export type ModelResolverRuntime = Pick<ModelRuntime, 'getModel' | 'hasConfiguredAuth'> & {
  getAvailable(
    ...args: Parameters<ModelRuntime['getAvailable']>
  ): ReturnType<ModelRuntime['getAvailable']> | readonly Model<any>[];
};

/** C's SettingsManager (and test doubles). */
export type ModelResolverSettings = Pick<SettingsManager, 'getDefaultProvider' | 'getDefaultModel'>;

export interface ResolveModelInput {
  model?: BotModel | { provider: string; modelId?: string; id?: string } | string | null;
}

export interface ResolveModelResult {
  model: Model<any> | null;
  /** True when the requested model was unused and a fallback was selected. */
  fallback: boolean;
  reason?: string;
}

/**
 * Legacy Chief / config defaults that must not be treated as a real selection.
 * `deepseek-chat` is gone in pi 1.1.0; `custom` is not a provider.
 */
export function isLegacyDefaultModel(provider: string, id: string): boolean {
  if (provider === 'custom') return true;
  return provider === 'deepseek' && id === 'deepseek-chat';
}

export function parseModelString(value: string): ModelRef | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return null;
  return {
    provider: trimmed.slice(0, slash),
    id: trimmed.slice(slash + 1),
  };
}

/**
 * Normalize persisted / request model values to `{provider,id} | null`.
 * Accepts a string (`provider/id`), `{provider,modelId}`, `{provider,id}`,
 * and maps legacy `custom/*` plus `deepseek/deepseek-chat` to null.
 */
export function normalizeBotModel(raw: unknown): BotModel {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    const parsed = parseModelString(raw);
    if (!parsed) return null;
    if (isLegacyDefaultModel(parsed.provider, parsed.id)) return null;
    return parsed;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const provider = typeof obj['provider'] === 'string' ? obj['provider'] : '';
    const id =
      typeof obj['id'] === 'string'
        ? obj['id']
        : typeof obj['modelId'] === 'string'
          ? obj['modelId']
          : '';
    if (!provider || !id) return null;
    if (isLegacyDefaultModel(provider, id)) return null;
    return { provider, id };
  }
  return null;
}

export function normalizeThinking(raw: unknown): ThinkingLevel | null {
  if (typeof raw !== 'string') return null;
  return (THINKING_LEVELS as readonly string[]).includes(raw)
    ? (raw as ThinkingLevel)
    : null;
}

function modelHasAuth(runtime: ModelResolverRuntime, model: Model<any> | undefined): model is Model<any> {
  return Boolean(model && runtime.hasConfiguredAuth(model.provider));
}

async function firstAvailableWithAuth(
  runtime: ModelResolverRuntime
): Promise<Model<any> | null> {
  const available = await runtime.getAvailable();
  for (const model of available) {
    if (runtime.hasConfiguredAuth(model.provider)) {
      return model;
    }
  }
  return available[0] ?? null;
}

/**
 * Resolve `bot.model` to a Model object.
 *
 * - `null` / missing → `null` (caller omits `model` so the SDK follows pi default)
 * - `{provider,id}` → that Model if it exists and has auth
 * - otherwise pi settings default (if authed)
 * - otherwise first available model with auth
 * - otherwise `null` (still follow pi default)
 */
export async function resolveModel(
  bot: ResolveModelInput,
  runtime: ModelResolverRuntime,
  settings?: ModelResolverSettings
): Promise<Model<any> | null> {
  const result = await resolveModelDetailed(bot, runtime, settings);
  return result.model;
}

export async function resolveModelDetailed(
  bot: ResolveModelInput,
  runtime: ModelResolverRuntime,
  settings?: ModelResolverSettings
): Promise<ResolveModelResult> {
  const requested = normalizeBotModel(bot.model);

  if (requested) {
    const exact = runtime.getModel(requested.provider, requested.id);
    if (modelHasAuth(runtime, exact)) {
      return { model: exact, fallback: false };
    }
  } else {
    // Explicit follow-pi-default: do not pick a model here.
    return { model: null, fallback: false, reason: 'follow-pi-default' };
  }

  const defaultProvider = settings?.getDefaultProvider();
  const defaultModelId = settings?.getDefaultModel();
  if (defaultProvider && defaultModelId) {
    const fromSettings = runtime.getModel(defaultProvider, defaultModelId);
    if (modelHasAuth(runtime, fromSettings)) {
      return {
        model: fromSettings,
        fallback: true,
        reason: `requested ${requested.provider}/${requested.id} unavailable; using settings default`,
      };
    }
  }

  const first = await firstAvailableWithAuth(runtime);
  if (first) {
    return {
      model: first,
      fallback: true,
      reason: `requested ${requested.provider}/${requested.id} unavailable; using first available`,
    };
  }

  return {
    model: null,
    fallback: true,
    reason: `requested ${requested.provider}/${requested.id} unavailable; follow pi default`,
  };
}
