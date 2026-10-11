/**
 * Secrets management routes
 */

import type { Hono } from 'hono';
import type { SecretsManager } from '../../secrets/index.js';
import type { SecretApprovalRequest } from '#shared/index.js';

export function setupSecretRoutes(app: Hono, secrets: SecretsManager) {
  // List secrets (without values)
  app.get('/api/secrets', async (c) => {
    const botId = c.req.query('botId');
    const list = await secrets.list(botId);
    return c.json({ success: true, data: { secrets: list } });
  });

  // Approve/create secret (UI only)
  app.post('/api/secrets/:name/approve', async (c) => {
    const name = c.req.param('name');
    const body = (await c.req.json()) as SecretApprovalRequest & { requestedBy: string };

    try {
      await secrets.approveSecret(name, body, body.requestedBy);
      return c.json({ success: true, data: { success: true } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to approve secret',
        },
        400
      );
    }
  });

  // Delete secret
  app.delete('/api/secrets/:name', async (c) => {
    const name = c.req.param('name');

    try {
      await secrets.delete(name);
      return c.json({ success: true, data: { success: true } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete secret',
        },
        400
      );
    }
  });

  // Get secret value (for internal use / bot runtime)
  app.get('/api/secrets/:name/value', async (c) => {
    const name = c.req.param('name');
    const botId = c.req.query('botId');

    if (!botId) {
      return c.json({ success: false, error: 'botId required' }, 400);
    }

    try {
      const value = await secrets.getValue(name, botId);
      if (value === null) {
        return c.json({ success: false, error: 'Secret not found or access denied' }, 404);
      }
      return c.json({ success: true, data: { value } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get secret',
        },
        400
      );
    }
  });
}
