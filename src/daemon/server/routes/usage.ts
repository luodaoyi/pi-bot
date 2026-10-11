/**
 * Usage tracking routes
 */

import type { Hono } from 'hono';
import type { UsageTracker } from '../../usage/index.js';
import type { UsageAggregation, UsageQueryParams } from '#shared/index.js';

function periodRange(period: 'day' | 'week' | 'month'): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  if (period === 'day') {
    start.setDate(start.getDate() - 1);
  } else if (period === 'month') {
    start.setDate(start.getDate() - 30);
  } else {
    start.setDate(start.getDate() - 7);
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function toGuiStats(
  period: 'day' | 'week' | 'month',
  aggregations: UsageAggregation[],
  startDate: string,
  endDate: string
) {
  const byBot: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    cost?: number;
  }> = {};
  const byModel: Record<string, { inputTokens: number; outputTokens: number; cost?: number }> = {};
  const total = { inputTokens: 0, outputTokens: 0, cost: 0 };

  for (const agg of aggregations) {
    const stats = agg.stats;
    const inputTokens = stats.totalInputTokens ?? 0;
    const outputTokens = stats.totalOutputTokens ?? 0;
    const cost = (stats.totalCost ?? 0) / 100;
    const entry = {
      inputTokens,
      outputTokens,
      cacheReadTokens: stats.totalCacheReadTokens ?? 0,
      cacheWriteTokens: stats.totalCacheWriteTokens ?? 0,
      cost,
    };
    if (agg.botId) {
      byBot[agg.botId] = entry;
    }
    if (agg.model) {
      byModel[agg.model] = { inputTokens, outputTokens, cost };
    }
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
    total.cost += cost;
  }

  return { period, startDate, endDate, byBot, byModel, total };
}

export function setupUsageRoutes(app: Hono, usage: UsageTracker) {
  // Query usage records
  app.get('/api/usage/records', async (c) => {
    const params: UsageQueryParams = {
      botId: c.req.query('botId'),
      model: c.req.query('model'),
      kind: c.req.query('kind'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined,
    };

    try {
      const result = await usage.query(params);
      return c.json({ success: true, data: result });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to query usage',
        },
        400
      );
    }
  });

  // GUI-friendly alias
  app.get('/api/usage', async (c) => {
    const period = (c.req.query('period') ?? 'week') as 'day' | 'week' | 'month';
    const range = periodRange(period);
    const params: UsageQueryParams = {
      botId: c.req.query('botId'),
      startDate: c.req.query('startDate') ?? range.startDate,
      endDate: c.req.query('endDate') ?? range.endDate,
    };

    try {
      const aggregations = await usage.aggregate('bot', params);
      const stats = toGuiStats(period, aggregations, params.startDate!, params.endDate!);
      return c.json({ success: true, data: { aggregations, stats } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get usage',
        },
        400
      );
    }
  });

  // Get aggregated statistics
  app.get('/api/usage/stats', async (c) => {
    const groupBy = (c.req.query('groupBy') ?? 'bot') as 'bot' | 'model' | 'day';
    const period = (c.req.query('period') ?? 'week') as 'day' | 'week' | 'month';
    const range = periodRange(period);
    const params: UsageQueryParams = {
      botId: c.req.query('botId'),
      model: c.req.query('model'),
      kind: c.req.query('kind'),
      startDate: c.req.query('startDate') ?? range.startDate,
      endDate: c.req.query('endDate') ?? range.endDate,
    };

    try {
      const aggregations = await usage.aggregate(groupBy, params);
      const stats = toGuiStats(period, aggregations, params.startDate!, params.endDate!);
      return c.json({ success: true, data: { aggregations, stats } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get stats',
        },
        400
      );
    }
  });

  // Get bot statistics
  app.get('/api/usage/bots/:botId/stats', async (c) => {
    const botId = c.req.param('botId');
    const days = c.req.query('days') ? parseInt(c.req.query('days')!) : 30;

    try {
      const stats = await usage.getBotStats(botId, days);
      return c.json({ success: true, data: { stats } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get bot stats',
        },
        400
      );
    }
  });

  // Clear old records
  app.post('/api/usage/cleanup', async (c) => {
    const days = c.req.query('days') ? parseInt(c.req.query('days')!) : 90;

    try {
      const count = await usage.clearOldRecords(days);
      return c.json({ success: true, data: { deletedCount: count } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cleanup',
        },
        400
      );
    }
  });
}
