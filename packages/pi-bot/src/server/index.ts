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
import { SessionPool } from '../sessions/index.js';
import { TeamCoordinator } from '../team/index.js';
import { GroupManager } from '../groups/index.js';
import { setupRoutes } from './routes/index.js';
import { setupSSE } from './sse.js';

export async function serve(options: { configPath?: string; dev: boolean }) {
  const config = await loadConfig(options.configPath);

  console.log('Starting pi-bot daemon...');
  console.log(`Home: ${expandHome(config.host.home)}`);
  console.log(`Listen: ${config.host.listen}`);

  // Initialize store
  const store = await createStore(config);

  // Initialize session pool
  const sessionPool = new SessionPool({
    maxSessions: config.host.maxSessions,
    idleTimeoutMs: config.host.idleSeconds * 1000,
    sessionDir: join(expandHome(config.host.home), 'sessions'),
  });

  // Initialize team coordinator
  const teamCoordinator = new TeamCoordinator(store, sessionPool);

  // Initialize group manager
  const groupManager = new GroupManager(store, sessionPool);

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

  // Mount all feature routes
  setupRoutes(app, store, config, { sessionPool, teamCoordinator, groupManager });

  // SSE endpoint with team coordinator for questions
  setupSSE(app, store, teamCoordinator);

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
      await sessionPool.destroy();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());
  });
}
