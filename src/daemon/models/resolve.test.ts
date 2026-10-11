/**
 * resolveModel fallbacks using pi-ai faux provider models.
 */

import { describe, expect, it } from 'vitest';
import { fauxProvider } from '@earendil-works/pi-ai';
import type { Model } from '@earendil-works/pi-ai';
import {
  isLegacyDefaultModel,
  normalizeBotModel,
  normalizeThinking,
  resolveModel,
  resolveModelDetailed,
  type ModelResolverRuntime,
  type ModelResolverSettings,
} from './resolve.js';

function runtimeFromFaux(
  handle: ReturnType<typeof fauxProvider>,
  authedProviders: string[]
): ModelResolverRuntime {
  const models = handle.models as unknown as Model<any>[];
  const authed = new Set(authedProviders);
  return {
    getModel(provider, id) {
      return models.find((m) => m.provider === provider && m.id === id);
    },
    hasConfiguredAuth(provider) {
      return authed.has(provider);
    },
    getAvailable() {
      return models.filter((m) => authed.has(m.provider));
    },
  };
}

describe('normalizeBotModel', () => {
  it('maps string and {provider,modelId} to {provider,id}', () => {
    expect(normalizeBotModel('openai/gpt-4o')).toEqual({ provider: 'openai', id: 'gpt-4o' });
    expect(normalizeBotModel({ provider: 'openai', modelId: 'gpt-4o' })).toEqual({
      provider: 'openai',
      id: 'gpt-4o',
    });
    expect(normalizeBotModel({ provider: 'openai', id: 'gpt-4o' })).toEqual({
      provider: 'openai',
      id: 'gpt-4o',
    });
  });

  it('nulls legacy Chief defaults and custom provider', () => {
    expect(normalizeBotModel('deepseek/deepseek-chat')).toBeNull();
    expect(normalizeBotModel({ provider: 'deepseek', modelId: 'deepseek-chat' })).toBeNull();
    expect(normalizeBotModel({ provider: 'custom', modelId: 'anything' })).toBeNull();
    expect(normalizeBotModel(null)).toBeNull();
    expect(isLegacyDefaultModel('deepseek', 'deepseek-chat')).toBe(true);
  });

  it('normalizes thinking levels', () => {
    expect(normalizeThinking('high')).toBe('high');
    expect(normalizeThinking('nope')).toBeNull();
  });
});

describe('resolveModel with faux provider', () => {
  const faux = fauxProvider({
    provider: 'faux',
    models: [
      { id: 'faux-fast', name: 'Faux Fast' },
      { id: 'faux-thinker', name: 'Faux Thinker', reasoning: true },
    ],
  });
  const settings: ModelResolverSettings = {
    getDefaultProvider: () => 'faux',
    getDefaultModel: () => 'faux-thinker',
  };

  it('returns the requested model when it exists and has auth', async () => {
    const runtime = runtimeFromFaux(faux, ['faux']);
    const model = await resolveModel({ model: { provider: 'faux', id: 'faux-fast' } }, runtime, settings);
    expect(model?.provider).toBe('faux');
    expect(model?.id).toBe('faux-fast');
  });

  it('returns null when bot.model is null (follow pi default)', async () => {
    const runtime = runtimeFromFaux(faux, ['faux']);
    const result = await resolveModelDetailed({ model: null }, runtime, settings);
    expect(result.model).toBeNull();
    expect(result.fallback).toBe(false);
    expect(result.reason).toBe('follow-pi-default');
  });

  it('falls back to settings default when requested model has no auth', async () => {
    const runtime = runtimeFromFaux(faux, ['faux']);
    const result = await resolveModelDetailed(
      { model: { provider: 'deepseek', id: 'deepseek-v4-pro' } },
      runtime,
      settings
    );
    expect(result.model?.id).toBe('faux-thinker');
    expect(result.fallback).toBe(true);
  });

  it('falls back to first available with auth when settings default is missing', async () => {
    const runtime = runtimeFromFaux(faux, ['faux']);
    const emptySettings: ModelResolverSettings = {
      getDefaultProvider: () => undefined,
      getDefaultModel: () => undefined,
    };
    const result = await resolveModelDetailed(
      { model: { provider: 'missing', id: 'nope' } },
      runtime,
      emptySettings
    );
    expect(result.model?.id).toBe('faux-fast');
    expect(result.fallback).toBe(true);
  });

  it('returns null when nothing is available with auth', async () => {
    const runtime = runtimeFromFaux(faux, []);
    const result = await resolveModelDetailed(
      { model: { provider: 'faux', id: 'faux-fast' } },
      runtime,
      settings
    );
    expect(result.model).toBeNull();
    expect(result.fallback).toBe(true);
  });
});
