/**
 * HTTP API server for pi-bot
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Config } from '../config.js';
import { loadConfig, expandHome } from '../config.js';
import { createStore } from '../store/index.js';
import { setupBotRoutes } from './routes/bots.js';
import { setupSystemRoutes } from './routes/system.js';
import { setupSSE } from './sse.js';

export async function serve(options: { configPath?: string; dev: boolean }) {
  const config = await loadConfig(options.configPath);

  console.log('Starting pi-bot daemon...');
  console.log(`Home: ${expandHome(config.host.home)}`);
  console.log(`Listen: ${config.host.listen}`);

  // Initialize store
  const store = await createStore(config);

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

  // Start listening
  return new Promise<void>((resolve) => {
    const server = Bun?.serve
      ? Bun.serve({
          fetch: app.fetch,
          port,
          hostname: host,
        })
      : null;

    if (!server) {
      // Fallback to Node.js http server
      import('node:http').then((http) => {
        http
          .createServer((req, res) => {
            app
              .fetch(new Request(`http://${req.headers.host}${req.url}`, {
                method: req.method,
                headers: req.headers as HeadersInit,
              }))
              .then((response) => {
                res.writeHead(response.status, Object.fromEntries(response.headers));
                response.body?.pipeTo(
                  new WritableStream({
                    write(chunk) {
                      res.write(chunk);
                    },
                    close() {
                      res.end();
                    },
                  })
                );
              })
              .catch((error) => {
                console.error('Request error:', error);
                res.writeHead(500);
                res.end('Internal Server Error');
              });
          })
          .listen(port, host ?? 'localhost', () => {
            resolve();
          });
      });
    }

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down...');
      process.exit(0);
    });
  });
}
