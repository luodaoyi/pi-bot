/**
 * Map pi AgentSession events to CONTRACT SSE payloads.
 * Do not filter on message.id — AssistantMessage has none.
 */

import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import type { BotSseEvent, SessionStats } from '#shared/index.js';

export interface EventContext {
  botId: string;
  sessionId: string;
  runId: string;
}

export function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      const rec = block as { type?: string; text?: string };
      return rec.type === 'text' && typeof rec.text === 'string' ? rec.text : '';
    })
    .filter(Boolean)
    .join('');
}

export function messageRole(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const role = (message as { role?: unknown }).role;
  return typeof role === 'string' ? role : undefined;
}

export function assistantUsage(message: unknown): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
} | null {
  if (!message || typeof message !== 'object') return null;
  const rec = message as {
    role?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      cost?: { total?: number } | number;
    };
  };
  if (rec.role !== 'assistant' || !rec.usage) return null;
  const cost =
    typeof rec.usage.cost === 'number'
      ? rec.usage.cost
      : (rec.usage.cost?.total ?? 0);
  return {
    input: rec.usage.input ?? 0,
    output: rec.usage.output ?? 0,
    cacheRead: rec.usage.cacheRead ?? 0,
    cacheWrite: rec.usage.cacheWrite ?? 0,
    cost,
  };
}

function base(ctx: EventContext): Pick<BotSseEvent, 'botId' | 'sessionId' | 'runId'> {
  return {
    botId: ctx.botId,
    sessionId: ctx.sessionId,
    runId: ctx.runId,
  };
}

export function mapSessionEvent(
  event: AgentSessionEvent,
  ctx: EventContext
): BotSseEvent[] {
  const out: BotSseEvent[] = [];

  switch (event.type) {
    case 'message_start':
      out.push({
        type: 'bot.message_start',
        ...base(ctx),
        role: messageRole(event.message),
        text: extractText(event.message),
      });
      break;

    case 'message_update': {
      const ame = event.assistantMessageEvent;
      if (ame?.type === 'text_delta') {
        out.push({
          type: 'bot.text_delta',
          ...base(ctx),
          delta: ame.delta,
        });
      } else if (ame?.type === 'thinking_delta') {
        out.push({
          type: 'bot.thinking_delta',
          ...base(ctx),
          delta: ame.delta,
        });
      }
      break;
    }

    case 'message_end':
      out.push({
        type: 'bot.message_end',
        ...base(ctx),
        role: messageRole(event.message),
        text: extractText(event.message),
      });
      break;

    case 'tool_execution_start':
      out.push({
        type: 'bot.tool_start',
        ...base(ctx),
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
      break;

    case 'tool_execution_update':
      out.push({
        type: 'bot.tool_update',
        ...base(ctx),
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        result: event.partialResult,
      });
      break;

    case 'tool_execution_end':
      out.push({
        type: 'bot.tool_end',
        ...base(ctx),
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: undefined,
        result: event.result,
        isError: event.isError,
      });
      break;

    case 'turn_end':
    case 'agent_settled':
      out.push({
        type: 'bot.turn_end',
        ...base(ctx),
      });
      break;

    default:
      break;
  }

  return out;
}

export function statsEvent(ctx: EventContext, stats: SessionStats): BotSseEvent {
  return {
    type: 'bot.stats',
    ...base(ctx),
    stats,
  };
}

export function errorEvent(ctx: EventContext, error: string): BotSseEvent {
  return {
    type: 'bot.error',
    ...base(ctx),
    error,
  };
}
