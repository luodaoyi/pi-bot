/**
 * Task scheduling routes
 */

import type { Hono } from 'hono';
import type { Scheduler } from '../../scheduler/index.js';
import type { ScheduleCreateRequest, ScheduleUpdateRequest } from '#shared/index.js';

export function setupTaskRoutes(app: Hono, scheduler: Scheduler) {
  // List schedules
  app.get('/api/tasks', async (c) => {
    const botId = c.req.query('botId');
    const schedules = await scheduler.list(botId);
    return c.json({ success: true, data: { schedules } });
  });

  // Get schedule by ID
  app.get('/api/tasks/:id', async (c) => {
    const id = c.req.param('id');
    const schedule = await scheduler.get(id);

    if (!schedule) {
      return c.json({ success: false, error: 'Schedule not found' }, 404);
    }

    return c.json({ success: true, data: { schedule } });
  });

  // Create schedule
  app.post('/api/tasks', async (c) => {
    const body = (await c.req.json()) as ScheduleCreateRequest;

    try {
      const schedule = await scheduler.create(body);
      return c.json({ success: true, data: { schedule } }, 201);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create schedule',
        },
        400
      );
    }
  });

  // Update schedule
  app.patch('/api/tasks/:id', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json()) as ScheduleUpdateRequest;

    try {
      const schedule = await scheduler.update(id, body);
      return c.json({ success: true, data: { schedule } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update schedule',
        },
        400
      );
    }
  });

  // Toggle enabled
  app.post('/api/tasks/:id/toggle', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };

    try {
      const current = await scheduler.get(id);
      if (!current) {
        return c.json({ success: false, error: 'Schedule not found' }, 404);
      }
      const enabled = body.enabled ?? !current.enabled;
      const schedule = await scheduler.update(id, { enabled });
      return c.json({ success: true, data: { schedule } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to toggle schedule',
        },
        400
      );
    }
  });

  // Delete schedule
  app.delete('/api/tasks/:id', async (c) => {
    const id = c.req.param('id');

    try {
      await scheduler.delete(id);
      return c.json({ success: true, data: { success: true } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete schedule',
        },
        400
      );
    }
  });
}
