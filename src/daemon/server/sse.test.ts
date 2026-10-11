/**
 * /api/events 必须保持连接，才能把 bot_event 推到 GUI。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { setupSSE } from './sse.js';
import type { Store } from '../store/index.js';
import type { SessionPool } from '../sessions/index.js';
import type { SSEEvent } from '#shared/index.js';

function mockStore(): Store {
  const listeners = new Set<(event: SSEEvent) => void>();
  return {
    onAny(listener: (event: SSEEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as Store;
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (buffer: string) => boolean,
  timeoutMs = 3000
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  const start = Date.now();
  while (!predicate(buffer)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`SSE timed out. so far:\n${buffer}`);
    }
    const { done, value } = await reader.read();
    if (done) {
      throw new Error(`SSE closed before expected payload.\n${buffer}`);
    }
    buffer += decoder.decode(value, { stream: true });
  }
  return buffer;
}

describe('GET /api/events', () => {
  let server: ServerType | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it('stays open and forwards bot.text_delta from the session pool', async () => {
    const app = new Hono();
    const pool = new EventEmitter();
    setupSSE(app, mockStore(), pool as unknown as SessionPool);

    const port = await new Promise<number>((resolve) => {
      server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, (info) => {
        resolve(info.port);
      });
    });

    const response = await fetch(`http://127.0.0.1:${port}/api/events`);
    expect(response.status).toBe(200);
    expect(response.body).toBeTruthy();

    const reader = response.body!.getReader();
    await readUntil(reader, (buf) => buf.includes('Connected to pi-bot event stream'));

    pool.emit('bot_event', {
      type: 'bot_event',
      event: {
        type: 'bot.text_delta',
        botId: 'bot-1',
        sessionId: 'sess-1',
        runId: 'run-1',
        delta: 'hello from faux stream',
      },
    });

    const received = await readUntil(reader, (buf) => buf.includes('hello from faux stream'));
    expect(received).toContain('bot.text_delta');
    await reader.cancel();
  });
});
