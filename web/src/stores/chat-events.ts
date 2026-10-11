import type { Message } from '@/types';
import type { BotSseEvent, PiToolCall, SessionStats } from '@/api/types';
import { emptySessionStats } from '@/api/types';
import { stringifyUnknown } from '@/api/normalize';

export interface ChatRuntime {
  messages: Message[];
  isStreaming: boolean;
  runId: string | null;
  stats: SessionStats;
  assistantId: string | null;
}

export function createChatRuntime(messages: Message[] = []): ChatRuntime {
  return {
    messages,
    isStreaming: false,
    runId: null,
    stats: emptySessionStats(),
    assistantId: null,
  };
}

function upsertAssistant(runtime: ChatRuntime, id?: string): { next: ChatRuntime; index: number } {
  const assistantId = id || runtime.assistantId || `msg-${Date.now()}-assistant`;
  const index = runtime.messages.findIndex((m) => m.id === assistantId);
  if (index >= 0) {
    return { next: { ...runtime, assistantId }, index };
  }
  const message: Message = {
    id: assistantId,
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    streaming: true,
    toolCalls: [],
  };
  return {
    next: {
      ...runtime,
      assistantId,
      isStreaming: true,
      messages: [...runtime.messages, message],
    },
    index: runtime.messages.length,
  };
}

function patchMessage(runtime: ChatRuntime, index: number, patch: Partial<Message>): ChatRuntime {
  const messages = runtime.messages.map((m, i) => (i === index ? { ...m, ...patch } : m));
  return { ...runtime, messages };
}

function upsertTool(tools: PiToolCall[] | undefined, patch: Partial<PiToolCall> & { id: string }): PiToolCall[] {
  const list = [...(tools ?? [])];
  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<PiToolCall> & { id: string };
  const idx = list.findIndex((t) => t.id === cleaned.id);
  if (idx < 0) {
    list.push({
      id: cleaned.id,
      name: cleaned.name ?? 'tool',
      arguments: cleaned.arguments ?? {},
      status: cleaned.status ?? 'pending',
      result: cleaned.result,
      liveOutput: cleaned.liveOutput,
      isError: cleaned.isError,
    });
    return list;
  }
  list[idx] = { ...list[idx], ...cleaned };
  return list;
}

export function applyBotEvent(runtime: ChatRuntime, event: BotSseEvent): ChatRuntime {
  switch (event.type) {
    case 'bot.message_start': {
      const started = upsertAssistant({ ...runtime, runId: event.runId ?? runtime.runId, isStreaming: true }, event.messageId);
      return started.next;
    }
    case 'bot.text_delta': {
      const { next, index } = upsertAssistant(runtime, event.messageId);
      const current = next.messages[index];
      return patchMessage(next, index, { content: (current.content || '') + (event.delta ?? '') });
    }
    case 'bot.thinking_delta': {
      const { next, index } = upsertAssistant(runtime, event.messageId);
      const current = next.messages[index];
      return patchMessage(next, index, { thinking: (current.thinking || '') + (event.delta ?? '') });
    }
    case 'bot.tool_start': {
      const { next, index } = upsertAssistant(runtime, event.messageId);
      const current = next.messages[index];
      return patchMessage(next, index, {
        toolCalls: upsertTool(current.toolCalls, {
          id: event.toolCallId || `tool-${Date.now()}`,
          name: event.toolName,
          arguments: event.args ?? {},
          status: 'running',
        }),
      });
    }
    case 'bot.tool_update': {
      const { next, index } = upsertAssistant(runtime, event.messageId);
      const current = next.messages[index];
      return patchMessage(next, index, {
        toolCalls: upsertTool(current.toolCalls, {
          id: event.toolCallId || current.toolCalls?.[current.toolCalls.length - 1]?.id || 'tool',
          name: event.toolName,
          arguments: event.args,
          liveOutput: stringifyUnknown(event.result) || undefined,
          status: 'running',
        }),
      });
    }
    case 'bot.tool_end': {
      const { next, index } = upsertAssistant(runtime, event.messageId);
      const current = next.messages[index];
      return patchMessage(next, index, {
        toolCalls: upsertTool(current.toolCalls, {
          id: event.toolCallId || current.toolCalls?.[current.toolCalls.length - 1]?.id || 'tool',
          name: event.toolName,
          arguments: event.args,
          result: stringifyUnknown(event.result),
          status: event.isError ? 'error' : 'success',
          isError: Boolean(event.isError),
        }),
      });
    }
    case 'bot.stats': {
      return { ...runtime, stats: event.stats ?? runtime.stats };
    }
    case 'bot.message_end': {
      if (!runtime.assistantId && !event.messageId) {
        return { ...runtime, isStreaming: false };
      }
      const { next, index } = upsertAssistant(runtime, event.messageId);
      return {
        ...patchMessage(next, index, {
          streaming: false,
          content: event.text || next.messages[index].content,
        }),
      };
    }
    case 'bot.turn_end': {
      const assistantId = runtime.assistantId;
      if (!assistantId) return { ...runtime, isStreaming: false, runId: event.runId ?? runtime.runId };
      const index = runtime.messages.findIndex((m) => m.id === assistantId);
      if (index < 0) return { ...runtime, isStreaming: false };
      return { ...patchMessage(runtime, index, { streaming: false }), isStreaming: false };
    }
    case 'bot.error': {
      const { next, index } = upsertAssistant(runtime, event.messageId);
      return {
        ...patchMessage(next, index, {
          streaming: false,
          error: event.error || event.message || '请求失败',
        }),
        isStreaming: false,
      };
    }
    default:
      return runtime;
  }
}

export function hintForChatError(error: string): { text: string; href?: string } | null {
  const match = error.match(/No API key found for\s+(\w+)/i)
    || error.match(/no auth(?:orization)? for(?: provider)?\s+(\w+)/i)
    || error.match(/未(?:登录|配置).{0,8}(\w+)/i);
  if (match) {
    const provider = match[1];
    return {
      text: `提供商 ${provider} 未登录或缺少 API Key，请到 设置 → 模型 / 提供商 登录。`,
      href: '/settings?tab=providers',
    };
  }
  if (/undefined/i.test(error) && /api key/i.test(error)) {
    return {
      text: '当前会话没有有效模型。请在顶部选择已登录的模型，或到 设置 → 模型 配置默认值。',
      href: '/settings?tab=models',
    };
  }
  return null;
}
