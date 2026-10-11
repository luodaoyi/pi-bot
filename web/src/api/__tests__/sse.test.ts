import { describe, expect, it } from 'vitest';
import { consumeSseBuffer } from '../sse';
import { normalizePiMessages, normalizeSseEvent } from '../normalize';

describe('consumeSseBuffer', () => {
  it('parses contract bot events and ignores heartbeat', () => {
    const raw = [
      'event: heartbeat',
      'data: {"timestamp":1}',
      '',
      'data: {"type":"bot.text_delta","botId":"b1","sessionId":"s1","runId":"r1","delta":"你好"}',
      '',
      'data: {"type":"delta","delta":"世界"}',
      '',
      'partial',
    ].join('\n');
    const { events, rest } = consumeSseBuffer(raw);
    expect(events.map((e) => e.type)).toEqual(['bot.text_delta', 'bot.text_delta']);
    expect(events[0].delta).toBe('你好');
    expect(rest).toBe('partial');
  });
});

describe('normalizeSseEvent / normalizePiMessages', () => {
  it('keeps role from A contract events', () => {
    const event = normalizeSseEvent({
      type: 'bot.message_start',
      botId: 'b',
      sessionId: 's',
      runId: 'r',
      role: 'user',
      text: 'hi',
    });
    expect(event?.role).toBe('user');
    expect(event?.text).toBe('hi');
  });

  it('flattens SDK content blocks into PiMessage', () => {
    const messages = normalizePiMessages([
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'hmm' },
          { type: 'text', text: 'hello' },
          { type: 'toolCall', id: 't1', name: 'read', arguments: { path: 'a' } },
          { type: 'toolResult', toolCallId: 't1', result: 'ok' },
        ],
      },
    ]);
    expect(messages[0].thinking).toBe('hmm');
    expect(messages[0].content).toBe('hello');
    expect(messages[0].toolCalls?.[0].name).toBe('read');
    expect(messages[0].toolCalls?.[0].result).toBe('ok');
  });
});
