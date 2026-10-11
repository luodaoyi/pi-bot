/**
 * Usage tracking routes
 */

import type { Hono } from 'hono';
import type { UsageTracker } from '../../usage/index.js';
import type { UsageQueryParams } from '@pi-bot/shared';

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

  // Get aggregated statistics
  app.get('/api/usage/stats', async (c) => {
    const groupBy = (c.req.query('groupBy') ?? 'bot') as 'bot' | 'model' | 'day';
    const params: UsageQueryParams = {
      botId: c.req.query('botId'),
      model: c.req.query('model'),
      kind: c.req.query('kind'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
    };

    try {
      const aggregations = await usage.aggregate(groupBy, params);
      return c.json({ success: true, data: { aggregations } });
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
