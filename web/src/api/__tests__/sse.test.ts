import { describe, expect, it } from 'vitest';
import { consumeSseBuffer } from '../sse';

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
