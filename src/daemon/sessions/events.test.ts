import { describe, expect, it } from 'vitest';
import { extractText, mapSessionEvent } from './events.js';

const ctx = { botId: 'bot-1', sessionId: 'ses-1', runId: 'run-1' };

describe('session event mapping', () => {
  it('extracts text from content blocks, not message.text/id', () => {
    expect(extractText({ role: 'assistant', content: [{ type: 'text', text: 'hi' }] })).toBe('hi');
    expect(extractText({ role: 'assistant', text: 'ignored', id: 'x' })).toBe('');
  });

  it('does not drop message_start when message has no id', () => {
    const events = mapSessionEvent(
      {
        type: 'message_start',
        message: { role: 'assistant', content: [{ type: 'text', text: '' }] },
      } as never,
      ctx
    );
    expect(events[0]?.type).toBe('bot.message_start');
    expect(events[0]?.botId).toBe('bot-1');
  });

  it('maps text and thinking deltas without id filters', () => {
    const text = mapSessionEvent(
      {
        type: 'message_update',
        message: { role: 'assistant', content: [] },
        assistantMessageEvent: { type: 'text_delta', delta: 'Hel' },
      } as never,
      ctx
    );
    const thinking = mapSessionEvent(
      {
        type: 'message_update',
        message: { role: 'assistant', content: [] },
        assistantMessageEvent: { type: 'thinking_delta', delta: 'hmm' },
      } as never,
      ctx
    );
    expect(text[0]).toMatchObject({ type: 'bot.text_delta', delta: 'Hel', runId: 'run-1' });
    expect(thinking[0]).toMatchObject({ type: 'bot.thinking_delta', delta: 'hmm' });
  });

  it('maps tool events with contract fields', () => {
    const start = mapSessionEvent(
      {
        type: 'tool_execution_start',
        toolCallId: 'c1',
        toolName: 'bash',
        args: { command: 'ls' },
      } as never,
      ctx
    );
    expect(start[0]).toMatchObject({
      type: 'bot.tool_start',
      toolCallId: 'c1',
      toolName: 'bash',
    });
  });
});
