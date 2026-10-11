/**
 * System routes (status, models, etc.)
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import { RespireClient } from '#respire-client/index.js';

export function setupSystemRoutes(app: Hono, store: Store, config: Config) {
  // System status
  app.get('/api/system/status', async (c) => {
    // Check Respire status
    let respireStatus;
    try {
      const client = new RespireClient({
        port: config.respire.port,
        autostart: false,
      });
      const health = await client.health();
      const agentConfig = await client.agentConfig();

      respireStatus = {
        available: true,
        version: health.bin,
        mode: agentConfig.memory_off ? 'off' : agentConfig.readonly ? 'readonly' : 'normal',
      };
    } catch {
      respireStatus = {
        available: false,
      };
    }

    return c.json({
      success: true,
      data: {
        version: '0.1.0',
        uptime: process.uptime(),
        activeSessions: await store.getActiveSessionCount(),
        memoryBackend: config.memory.backend,
        respireStatus,
      },
    });
  });

  // List available models
  app.get('/api/system/models', async (c) => {
    // TODO: Integrate with pi ModelRegistry to list models
    // For now, return a static list
    const models = [
      {
        provider: 'deepseek',
        modelId: 'deepseek-chat',
        name: 'DeepSeek Chat',
        contextWindow: 64000,
        supportsVision: false,
        supportsThinking: false,
      },
      {
        provider: 'deepseek',
        modelId: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        contextWindow: 64000,
        supportsVision: false,
        supportsThinking: true,
      },
    ];

    return c.json({
      success: true,
      data: { models },
    });
  });

  // Shutdown endpoint
  app.post('/api/shutdown', (c) => {
    setTimeout(() => {
      process.exit(0);
    }, 500);
    
    return c.json({ success: true, message: 'Shutting down...' });
  });
}
