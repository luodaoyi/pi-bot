/**
 * HTTP API server for pi-bot
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve as nodeServe } from '@hono/node-server';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { extname } from 'node:path';
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
import { createSettingsStore } from '../settings/index.js';
import { getPackageVersion } from '#shared/version.js';
import { cleanupLeftoverFiles } from '#shared/daemon-manager.js';

export async function serve(options: { configPath?: string; dev: boolean; port?: number; onReady?: () => void }) {
  const config = await loadConfig(options.configPath);

  console.log('Starting pi-bot daemon...');
  console.log(`Home: ${expandHome(config.host.home)}`);
  
  const homeDir = expandHome(config.host.home);
  
  // Setup error logging
  const logFile = join(homeDir, 'logs', 'daemon.log');
  const logDir = dirname(logFile);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  
  const logError = (prefix: string, error: any) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${prefix}: ${error?.stack || error}\n`;
    console.error(message);
    try {
      appendFileSync(logFile, message);
    } catch {
      // Ignore logging errors
    }
  };
  
  process.on('uncaughtException', (error) => {
    logError('UNCAUGHT EXCEPTION', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    logError('UNHANDLED REJECTION', reason);
  });
  
  console.log(`Daemon logs: ${logFile}`);
  cleanupLeftoverFiles();

  // Initialize store
  const store = await createStore(config);
  const settingsStore = await createSettingsStore(homeDir);

  // Shared pi SDK services (one ModelRuntime / resourceLoader for all bots)
  const workspaceDir = expandHome(config.host.workspace);
  const sessionPool = new SessionPool({
    maxSessions: config.host.maxSessions,
    idleTimeoutMs: config.host.idleSeconds * 1000,
    sessionDir: join(homeDir, 'sessions'),
    workspaceDir,
    loadUserExtensions: config.pi.loadUserExtensions,
    loadContextFiles: config.pi.loadContextFiles,
  });

  // Initialize team coordinator
  const teamCoordinator = new TeamCoordinator(store, sessionPool);

  // Initialize group manager
  const groupManager = new GroupManager(store, sessionPool);

  // Initialize scheduler（时区默认跟用户设置，不是 UTC）
  const scheduler = await createScheduler({
    storePath: join(homeDir, 'schedules.json'),
    getDefaultTimezone: () => settingsStore.get().timezone || 'UTC',
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

  sessionPool.setHost({
    store,
    pool: sessionPool,
    scheduler,
    groups: groupManager,
    secrets,
    getTimezone: () => settingsStore.get().timezone || 'UTC',
  });
  try {
    await sessionPool.getServices();
  } catch (error) {
    console.error('Shared SDK services will be created on first session:', error);
  }

  // Initialize usage tracker
  const usage = await createUsageTracker({
    dbPath: join(homeDir, 'usage.sqlite'),
  });

  // Record usage from SDK session stats so /api/usage has real data
  sessionPool.on('usage', (payload: {
    botId: string;
    sessionId: string;
    stats: { tokens: { input: number; output: number; cacheRead: number; cacheWrite: number }; cost: number };
    model?: { provider?: string; id?: string };
  }) => {
    const tokens = payload.stats.tokens;
    if (!tokens.input && !tokens.output && !tokens.cacheRead && !tokens.cacheWrite) {
      return;
    }
    usage
      .record(
        payload.botId,
        payload.sessionId,
        payload.model?.provider ?? 'unknown',
        payload.model?.id ?? 'unknown',
        'turn',
        tokens.input,
        tokens.cacheRead,
        tokens.cacheWrite,
        tokens.output,
        payload.stats.cost
      )
      .catch((err) => {
        console.error('Failed to record usage:', err);
      });
  });

  // Create Hono app
  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  const version = getPackageVersion();
  const healthPayload = () => ({
    status: 'ok' as const,
    version,
    pid: process.pid,
    home: homeDir,
    timestamp: new Date().toISOString(),
  });

  // Health check with process info
  app.get('/health', (c) => {
    return c.json(healthPayload());
  });

  // GUI ping() 别名
  app.get('/api/health', (c) => {
    return c.json({ success: true, data: healthPayload() });
  });

  // Mount all feature routes
  setupRoutes(app, store, config, {
    sessionPool,
    teamCoordinator,
    groupManager,
    scheduler,
    secrets,
    usage,
    settingsStore,
    respirePort: config.respire.port,
  });

  // SSE endpoint (store events + bot streaming)
  setupSSE(app, store, sessionPool);

  // Serve static files (web UI) with absolute path support
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const webDistPath = join(__dirname, '../../web');
  
  console.log(`Web UI path: ${webDistPath}`);
  
  if (!existsSync(join(webDistPath, 'index.html'))) {
    console.error(`ERROR: Web UI not found at ${webDistPath}`);
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api')) {
        return c.text('Not Found', 404);
      }
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head><title>Error - pi-bot</title></head>
          <body>
            <h1>Web UI Not Found</h1>
            <p>Expected location: <code>${webDistPath}</code></p>
            <p>Please reinstall pi-agent-bot</p>
          </body>
        </html>
      `, 500);
    });
  } else {
    // Custom static file handler with absolute paths
    app.get('*', (c) => {
      const path = c.req.path;
      
      // Skip API routes
      if (path.startsWith('/api')) {
        return c.text('Not Found', 404);
      }
      
      // Normalize and prevent path traversal
      const safePath = path.replace(/^\/+/, '').replace(/\.\./g, '');
      const filePath = join(webDistPath, safePath || 'index.html');
      
      // Ensure file is within webDistPath
      if (!filePath.startsWith(webDistPath)) {
        return c.text('Forbidden', 403);
      }
      
      // Try to serve the file
      if (existsSync(filePath) && !filePath.endsWith('/')) {
        try {
          const content = readFileSync(filePath);
          const ext = extname(filePath);
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          
          c.header('Content-Type', contentType);
          return c.body(content);
        } catch (error) {
          console.error(`Error serving ${filePath}:`, error);
          return c.text('Internal Server Error', 500);
        }
      }
      
      // SPA fallback: serve index.html for non-API routes
      try {
        const indexPath = join(webDistPath, 'index.html');
        const content = readFileSync(indexPath);
        c.header('Content-Type', 'text/html');
        return c.body(content);
      } catch (error) {
        console.error('Error serving index.html:', error);
        return c.text('Not Found', 404);
      }
    });
  }

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
        if (options.onReady) {
          options.onReady();
        }
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
