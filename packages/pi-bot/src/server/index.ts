/**
 * HTTP API server for pi-bot
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve as nodeServe } from '@hono/node-server';
import { join } from 'node:path';
import { loadConfig, expandHome } from '../config.js';
import { createStore } from '../store/index.js';
import { createScheduler } from '../scheduler/index.js';
import { createSecretsManager } from '../secrets/index.js';
import { createUsageTracker } from '../usage/index.js';
import { createMockDelivery } from '../delivery/index.js';
import { setupBotRoutes } from './routes/bots.js';
import { setupSystemRoutes } from './routes/system.js';
import { setupTaskRoutes } from './routes/tasks.js';
import { setupSecretRoutes } from './routes/secrets.js';
import { setupUsageRoutes } from './routes/usage.js';
import { setupSSE } from './sse.js';

export async function serve(options: { configPath?: string; dev: boolean }) {
  const config = await loadConfig(options.configPath);

  console.log('Starting pi-bot daemon...');
  console.log(`Home: ${expandHome(config.host.home)}`);
  console.log(`Listen: ${config.host.listen}`);

  // Initialize store
  const store = await createStore(config);

  // Initialize delivery (mock for now, will be replaced by session pool)
  const delivery = createMockDelivery();

  // Initialize scheduler
  const homeDir = expandHome(config.host.home);
  const scheduler = await createScheduler({
    storePath: join(homeDir, 'schedules.json'),
    onTrigger: async (schedule) => {
      await delivery.deliver(schedule.botId, schedule.prompt);
    },
  });

  // Initialize secrets manager
  const secrets = await createSecretsManager({
    storePath: join(homeDir, 'secrets.json'),
  });

  // Initialize usage tracker
  const usage = await createUsageTracker({
    dbPath: join(homeDir, 'usage.sqlite'),
  });

  // Create Hono app
  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  // Health check
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  setupBotRoutes(app, store, config);
  setupSystemRoutes(app, store, config);
  setupTaskRoutes(app, scheduler);
  setupSecretRoutes(app, secrets);
  setupUsageRoutes(app, usage);

  // SSE endpoint
  setupSSE(app, store);

  // Serve static files (web UI) - TODO
  // app.get('*', serveStatic({ root: './public' }));

  // Start server
  const [host, portStr] = config.host.listen.split(':');
  const port = parseInt(portStr ?? '8787', 10);

  console.log(`\n🚀 pi-bot daemon running on http://${host}:${port}`);
  console.log(`   API: http://${host}:${port}/api`);
  console.log(`   Events: http://${host}:${port}/api/events`);
  console.log('\nPress Ctrl+C to stop\n');

  // Bootstrap: Create Chief bot if first run
  await store.bootstrap();

  // Start listening using @hono/node-server
  return new Promise<void>((resolve) => {
    nodeServe(
      {
        fetch: app.fetch,
        port,
        hostname: host || '127.0.0.1',
      },
      () => {
        resolve();
      }
    );

    // Handle shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      await scheduler.shutdown();
      await usage.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
