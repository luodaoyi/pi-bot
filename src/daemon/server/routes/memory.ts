/**
 * Memory routes backed by Respire RPC (127.0.0.1:15169)
 * Respire 未运行时返回明确状态，不伪装成空列表。
 */
import type { Hono } from 'hono';
import { RespireClient } from '#respire-client/index.js';
import { RespireError } from '#respire-client/errors.js';
import { extractStatusCounts } from '#respire-client/envelopes.js';
import type { MemoryEntry as RespireMemoryEntry, RecallDetail } from '#respire-client/types.js';

const RESPIRE_DOWN = 'Respire not running';

function isUnavailable(error: unknown): boolean {
  if (error instanceof RespireError) {
    return (
      error.code === 'runtime_unavailable' ||
      error.code === 'runtime_transport' ||
      error.code === 'daemon_unavailable'
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return /econnrefused|not running|unavailable|fetch failed/i.test(message);
}

function toGuiEntry(
  entry: Partial<RespireMemoryEntry> & { id: string },
  extra: { scope?: string; score?: number } = {}
): Record<string, unknown> {
  const importance =
    entry.importance === 'high' || entry.importance === 'important' ? 'important' : 'trivial';
  return {
    id: entry.id,
    content: entry.content ?? '',
    title: entry.title,
    scope: entry.project ? 'team' : extra.scope ?? 'team',
    botId: undefined,
    kind: entry.kind,
    project: entry.project ?? '',
    importance,
    score: extra.score,
    createdAt: entry.created_at ?? new Date().toISOString(),
    updatedAt: entry.updated_at ?? entry.created_at ?? new Date().toISOString(),
    metadata: {},
  };
}

function recallToGui(item: RecallDetail, scope: string): Record<string, unknown> {
  return toGuiEntry(
    {
      id: item.id,
      title: item.title,
      content: item.content ?? '',
      kind: item.kind,
      importance: item.importance,
      project: item.project,
      created_at: item.created_at,
      updated_at: item.updated_at,
    },
    { scope, score: item.score }
  );
}

function downPayload(extra: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      available: false,
      reason: RESPIRE_DOWN,
      error: RESPIRE_DOWN,
      ...extra,
    },
  };
}

export function setupMemoryRoutes(app: Hono, respirePort: number) {
  const client = new RespireClient({ port: respirePort, autostart: false });

  async function withRespire<T>(
    c: { json: (body: unknown, status?: number) => Response },
    run: () => Promise<T>,
    emptyExtra: Record<string, unknown>
  ) {
    try {
      const data = await run();
      return c.json({ success: true, data: { available: true, ...data } });
    } catch (error) {
      if (isUnavailable(error)) {
        return c.json(downPayload(emptyExtra));
      }
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Memory request failed',
        },
        400
      );
    }
  }

  app.get('/api/memory/status', async (c) => {
    try {
      const health = await client.health();
      const status = await client.status().catch(() => ({}));
      const counts = extractStatusCounts(status);
      return c.json({
        success: true,
        data: {
          available: true,
          reason: null,
          health,
          status,
          counts,
        },
      });
    } catch (error) {
      if (isUnavailable(error)) {
        return c.json(downPayload({ health: null, status: null, counts: {} }));
      }
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get memory status',
        },
        400
      );
    }
  });

  app.get('/api/memory/search', async (c) => {
    const query = (c.req.query('query') ?? c.req.query('q') ?? '').trim();
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;
    const scope = c.req.query('scope') ?? 'all';
    const mode = c.req.query('mode') === 'quality' ? 'quality' : 'fast';
    const titles = c.req.query('titles') !== '0';

    return withRespire(
      c,
      async () => {
        if (query) {
          const result = await client.recall(query, { limit, mode, titles });
          return {
            entries: result.details.map((item) => recallToGui(item, scope)),
            source: 'recall',
            count: result.count,
          };
        }
        const listed = await client.list({ limit });
        return {
          entries: listed.map((entry) => toGuiEntry(entry, { scope })),
          source: 'list',
          count: listed.length,
        };
      },
      { entries: [], source: query ? 'recall' : 'list', count: 0 }
    );
  });

  app.get('/api/memory/summary', async (c) => {
    const scope = c.req.query('scope') ?? 'team';
    return withRespire(
      c,
      async () => {
        const listed = await client.list({ limit: 10 });
        const summary =
          listed.length === 0
            ? ''
            : listed
                .map((entry) => entry.title || entry.content?.slice(0, 80))
                .filter(Boolean)
                .join('；');
        return { summary, scope };
      },
      { summary: '', scope }
    );
  });

  app.get('/api/memory/:id', async (c) => {
    const id = c.req.param('id');
    if (id === 'search' || id === 'status' || id === 'summary' || id === 'recall' || id === 'remember') {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    return withRespire(
      c,
      async () => {
        const entry = await client.show(id);
        if (!entry) {
          throw new Error('Memory entry not found');
        }
        return { entry: toGuiEntry(entry) };
      },
      { entry: null }
    );
  });

  app.post('/api/memory/recall', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      query?: string;
      q?: string;
      limit?: number;
      mode?: 'fast' | 'quality';
      titles?: boolean;
    };
    const query = (body.query ?? body.q ?? '').trim();
    return withRespire(
      c,
      async () => {
        const result = await client.recall(query, {
          limit: body.limit ?? 20,
          mode: body.mode === 'quality' ? 'quality' : 'fast',
          titles: body.titles !== false,
        });
        return {
          result,
          entries: result.details.map((item) => recallToGui(item, 'all')),
        };
      },
      { entries: [] }
    );
  });

  app.post('/api/memory/remember', async (c) => {
    const body = (await c.req.json()) as { content: string; title?: string; importance?: string };
    try {
      const result = await client.remember(body.content, {
        title: body.title,
        importance: body.importance === 'important' ? 'important' : 'trivial',
      });
      return c.json({
        success: true,
        data: {
          available: true,
          entry: {
            id: result.id ?? `mem-${Date.now()}`,
            content: body.content,
            title: body.title,
            scope: 'team',
            importance: body.importance === 'important' ? 'important' : 'trivial',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          result,
        },
      }, 201);
    } catch (error) {
      if (isUnavailable(error)) {
        return c.json({ success: false, error: RESPIRE_DOWN, code: 'respire_unavailable' }, 503);
      }
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remember',
        },
        400
      );
    }
  });

  app.post('/api/bots/:botId/memory', async (c) => {
    const botId = c.req.param('botId');
    const body = (await c.req.json()) as { content: string; title?: string; importance?: string };
    try {
      const result = await client.remember(body.content, {
        title: body.title,
        importance: body.importance === 'important' ? 'important' : 'trivial',
        project: `pi-bot/${botId}`,
      });
      return c.json({
        success: true,
        data: {
          available: true,
          entry: {
            id: result.id ?? `mem-${Date.now()}`,
            content: body.content,
            title: body.title,
            scope: 'bot',
            botId,
            importance: body.importance === 'important' ? 'important' : 'trivial',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      }, 201);
    } catch (error) {
      if (isUnavailable(error)) {
        return c.json({ success: false, error: RESPIRE_DOWN, code: 'respire_unavailable' }, 503);
      }
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write memory',
        },
        400
      );
    }
  });

  app.patch('/api/memory/:id', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json()) as { content: string };
    try {
      await client.forget(id);
      const result = await client.remember(body.content);
      return c.json({
        success: true,
        data: {
          available: true,
          entry: {
            id: result.id ?? id,
            content: body.content,
            scope: 'team',
            importance: 'trivial',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      if (isUnavailable(error)) {
        return c.json({ success: false, error: RESPIRE_DOWN, code: 'respire_unavailable' }, 503);
      }
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update memory',
        },
        400
      );
    }
  });

  app.delete('/api/memory/:id', async (c) => {
    const id = c.req.param('id');
    try {
      await client.forget(id);
      return c.json({ success: true, data: { success: true, available: true } });
    } catch (error) {
      if (isUnavailable(error)) {
        return c.json({ success: false, error: RESPIRE_DOWN, code: 'respire_unavailable' }, 503);
      }
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to forget memory',
        },
        400
      );
    }
  });
}
