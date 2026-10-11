/**
 * GET/PATCH /api/settings — 持久化在 pi-bot home
 */
import type { Hono } from 'hono';
import type { GuiSettings } from '#shared/index.js';
import type { SettingsStore } from '../../settings/index.js';

export function setupSettingsRoutes(app: Hono, settingsStore: SettingsStore) {
  app.get('/api/settings', (c) => {
    return c.json({
      success: true,
      data: { settings: settingsStore.get() },
    });
  });

  app.patch('/api/settings', async (c) => {
    try {
      const body = (await c.req.json()) as Partial<GuiSettings>;
      const settings = await settingsStore.update(body);
      return c.json({ success: true, data: { settings } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update settings',
        },
        400
      );
    }
  });
}
