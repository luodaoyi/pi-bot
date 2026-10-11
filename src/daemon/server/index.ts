/**
 * HTTP API server for pi-bot
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve as nodeServe } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, expandHome } from '../config.js';
import { createStore } from '../store/index.js';
import { SessionPool } from '../sessions/index.js';
import { TeamCoordinator } from '../team/index.js';
import { GroupManager } from '../groups/index.js';
import { createScheduler } from '../scheduler/index.js';
import { createSecretsManager } from '../secrets/index.js';
import { createUsageTracker } from '../usage/index.js';
import { setupRoutes } from './routes/index.js';
import { setupSSE } from './sse.js';

export async function serve(options: { configPath?: string; dev: boolean; port?: number }) {
  const config = await loadConfig(options.configPath);

  console.log('Starting pi-bot daemon...');
  console.log(`Home: ${expandHome(config.host.home)}`);
  
  const homeDir = expandHome(config.host.home);

  // Initialize store
  const store = await createStore(config);

  // Initialize session pool
  const sessionPool = new SessionPool({
    maxSessions: config.host.maxSessions,
    idleTimeoutMs: config.host.idleSeconds * 1000,
    sessionDir: join(homeDir, 'sessions'),
  });

  // Initialize team coordinator
  const teamCoordinator = new TeamCoordinator(store, sessionPool);

  // Initialize group manager
  const groupManager = new GroupManager(store, sessionPool);

  // Initialize scheduler
  const scheduler = await createScheduler({
    storePath: join(homeDir, 'schedules.json'),
    onTrigger: async (schedule) => {
      // Use sessionPool to deliver scheduled messages
      try {
        const bot = await store.getBot(schedule.botId);
        if (!bot) {
          console.error(`Bot not found: ${schedule.botId}`);
          return;
        }
        await sessionPool.sendMessage(schedule.botId, schedule.prompt, bot);
      } catch (error) {
        console.error(`Failed to deliver scheduled message: ${error}`);
      }
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

  // Record usage from session pool events
  sessionPool.on('message_end', (event) => {
    if (event.type === 'message_end') {
      // TODO: Get actual token counts and model info from event
      usage.record(
        event.botId, // botId
        'session-' + event.botId, // sessionId - TODO: get actual session ID
        'unknown', // provider - TODO: get from bot config
        'unknown', // model - TODO: get from bot config
        'turn', // kind
        0, // inputTokens - TODO: get from event
        0, // cacheReadTokens
        0, // cacheWriteTokens
        0, // outputTokens - TODO: get from event
        0  // cost
      ).catch((err) => {
        console.error('Failed to record usage:', err);
      });
    }
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

  // Mount all feature routes
  setupRoutes(app, store, config, {
    sessionPool,
    teamCoordinator,
    groupManager,
    scheduler,
    secrets,
    usage,
  });

  // SSE endpoint
  setupSSE(app, store);

  // Serve static files (web UI)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const webDistPath = join(__dirname, '../../web');
  
  app.use('/*', serveStatic({ root: webDistPath }));
  app.get('*', serveStatic({ path: join(webDistPath, 'index.html') }));

  // Start server
  const [host, portStr] = config.host.listen.split(':');
  const port = options.port ?? parseInt(portStr ?? '8787', 10);

  console.log(`Listen: ${host}:${port}`);
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
      await scheduler.shutdown();
      await usage.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());
  });
}
