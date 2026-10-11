import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { startFakeRespire, stopFakeRespire } from '../../../../tests/helpers/fake-respire.js';
import type { Server } from 'node:http';
import { setupMemoryRoutes } from './memory.js';

describe('memory routes against real envelope shapes', () => {
  let server: Server;
  let app: Hono;

  beforeEach(async () => {
    const fake = await startFakeRespire(0);
    server = fake.server;
    app = new Hono();
    setupMemoryRoutes(app, fake.port);
  });

  afterEach(async () => {
    await stopFakeRespire(server);
  });

  it('GET /api/memory/search (no query) lists envelope.details', async () => {
    const res = await app.request('/api/memory/search?limit=5');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(body.data.entries).toHaveLength(3);
    expect(body.data.entries[0].title).toBe('Respire中英文文档已自动发布上线验收');
    expect(body.data.entries[0].kind).toBe('Context');
    expect(body.data.entries[0].importance).toBe('important');
  });

  it('accepts both q and query search params', async () => {
    const withQ = await app.request('/api/memory/search?q=pi-bot&limit=3');
    const withQuery = await app.request('/api/memory/search?query=pi-bot&limit=3');
    expect(withQ.status).toBe(200);
    expect(withQuery.status).toBe(200);
    const qBody = await withQ.json();
    const queryBody = await withQuery.json();
    expect(qBody.data.entries).toEqual([]);
    expect(queryBody.data.entries).toEqual([]);
    expect(qBody.data.source).toBe('recall');
  });

  it('recall skip is empty, not an error', async () => {
    const res = await app.request('/api/memory/search?q=pi-bot');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(body.data.entries).toEqual([]);
  });

  it('recall titles hits become GUI entries', async () => {
    const res = await app.request('/api/memory/search?query=%E6%96%87%E6%A1%A3');
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThan(0);
    expect(body.data.entries[0].id).toBe('d76f9bd3-1111-4111-8111-111111111111');
    expect(body.data.entries[0].title).toContain('Respire');
  });

  it('GET /api/memory/:id returns markdown content from show', async () => {
    const res = await app.request('/api/memory/d76f9bd3-1111-4111-8111-111111111111');
    const body = await res.json();
    expect(body.data.entry.content).toContain('# Respire docs shipped');
  });

  it('status exposes local_alive counts', async () => {
    const res = await app.request('/api/memory/status');
    const body = await res.json();
    expect(body.data.available).toBe(true);
    expect(body.data.counts.local_alive).toBe(3383);
  });
});
