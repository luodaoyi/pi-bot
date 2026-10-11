/**
 * Build CONTRACT stats objects from SDK session stats or persisted entries.
 */

import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { SessionStats } from '#shared/index.js';
import { assistantUsage } from './events.js';

export function emptyStats(): SessionStats {
  return {
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    cost: 0,
    contextUsage: null,
  };
}

export function statsFromSdk(input: {
  tokens?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  cost?: number;
  contextUsage?: {
    tokens?: number | null;
    contextWindow?: number;
    percent?: number | null;
  };
}): SessionStats {
  const tokens = {
    input: input.tokens?.input ?? 0,
    output: input.tokens?.output ?? 0,
    cacheRead: input.tokens?.cacheRead ?? 0,
    cacheWrite: input.tokens?.cacheWrite ?? 0,
    total: input.tokens?.total ?? 0,
  };
  if (!tokens.total) {
    tokens.total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
  }

  const ctx = input.contextUsage;
  const contextUsage =
    ctx && typeof ctx.contextWindow === 'number'
      ? {
          tokens: ctx.tokens ?? 0,
          contextWindow: ctx.contextWindow,
          percent: ctx.percent ?? 0,
        }
      : null;

  return {
    tokens,
    cost: input.cost ?? 0,
    contextUsage,
  };
}

export function statsFromEntries(entries: SessionEntry[]): SessionStats {
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
  let cost = 0;

  for (const entry of entries) {
    if (entry.type === 'message') {
      const usage = assistantUsage(entry.message);
      if (!usage) continue;
      tokens.input += usage.input;
      tokens.output += usage.output;
      tokens.cacheRead += usage.cacheRead;
      tokens.cacheWrite += usage.cacheWrite;
      cost += usage.cost;
    } else if (entry.type === 'usage') {
      tokens.input += entry.usage.input ?? 0;
      tokens.output += entry.usage.output ?? 0;
      tokens.cacheRead += entry.usage.cacheRead ?? 0;
      tokens.cacheWrite += entry.usage.cacheWrite ?? 0;
      const entryCost = entry.usage.cost;
      cost += typeof entryCost === 'number' ? entryCost : (entryCost?.total ?? 0);
    }
  }

  tokens.total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
  return { tokens, cost, contextUsage: null };
}

export function modelFromProjection(model: { provider: string; modelId: string } | null) {
  if (!model?.provider || !model.modelId) return null;
  return { provider: model.provider, id: model.modelId };
}
