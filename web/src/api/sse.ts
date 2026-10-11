import type { BotSseEvent } from './types';
import { normalizeSseEvent } from './normalize';

/** 解析 SSE 文本块，抽出 data: JSON 事件 */
export function parseSseChunk(chunk: string): unknown[] {
  const events: unknown[] = [];
  for (const block of chunk.split('\n\n')) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) continue;
    const payload = dataLines.join('\n');
    if (!payload || payload === '[DONE]') continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // 忽略无法解析的心跳或注释
    }
  }
  return events;
}

export function consumeSseBuffer(buffer: string): { events: BotSseEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: BotSseEvent[] = [];
  for (const part of parts) {
    for (const raw of parseSseChunk(`${part}\n\n`)) {
      const event = normalizeSseEvent(raw);
      if (event) events.push(event);
    }
  }
  return { events, rest };
}

export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: BotSseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeSseBuffer(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) onEvent(event);
    }
    if (buffer.trim()) {
      const parsed = consumeSseBuffer(`${buffer}\n\n`);
      for (const event of parsed.events) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}
