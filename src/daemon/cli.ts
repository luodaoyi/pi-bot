#!/usr/bin/env node
/**
 * pi-bot CLI entrypoint
 */

import './win-hide.js';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve } from './server/index.js';
import { init } from './commands/init.js';
import { doctor } from './commands/doctor.js';
import {
  ensureDaemon,
  getDaemonStatus,
  stopDaemon,
  openUrl,
  writePid,
  writePort,
} from '#shared/daemon-manager.js';

// Read version from package.json
// In dist/cli.js, __dirname is dist/daemon, so go up 2 levels to project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../..', 'package.json'), 'utf-8')
);
const VERSION = packageJson.version;

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      config: { type: 'string', short: 'c' },
      dev: { type: 'boolean' },
      port: { type: 'string', short: 'p' },
      'no-browser': { type: 'boolean' },
      force: { type: 'boolean', short: 'f' },
    },
    allowPositionals: true,
  });

  if (values.version) {
    console.log(`pi-bot ${VERSION}`);
    process.exit(0);
  }

  const command = positionals[0] || 'serve';

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'serve':
      case 'start': {
        const port = values.port ? parseInt(values.port, 10) : 8787;
        await serve({
          configPath: values.config,
          dev: values.dev ?? false,
          port,
          onReady: () => {
            writePid(process.pid);
            writePort(port);
          },
        });
        break;
      }

      case 'open': {
        const port = values.port ? parseInt(values.port, 10) : 8787;
        const { port: boundPort, started, pid } = await ensureDaemon(port);
        const { getHealthInfo } = await import('#shared/daemon-manager.js');
        const health = await getHealthInfo(boundPort);
        
        if (started) {
          console.log(`✓ Daemon started (PID: ${pid}, port: ${boundPort})`);
        } else {
          console.log(`✓ Daemon already running (PID: ${health?.pid || pid}, port: ${boundPort})`);
        }
        
        if (health) {
          console.log(`  Version: ${health.version}`);
          console.log(`  Home: ${health.home}`);
        }
        
        const url = `http://localhost:${boundPort}`;
        if (!values['no-browser']) {
          console.log(`Opening ${url} in browser...`);
          openUrl(url);
        } else {
          console.log(`Web UI available at ${url}`);
        }
        break;
      }

      case 'status': {
        const status = await getDaemonStatus();
        const { getHealthInfo } = await import('#shared/daemon-manager.js');
        
        if (status.running) {
          const health = await getHealthInfo(status.port);
          console.log(`✓ Daemon is running`);
          console.log(`  PID: ${status.pid}`);
          console.log(`  Port: ${status.port}`);
          if (health) {
            console.log(`  Version: ${health.version}`);
            console.log(`  Home: ${health.home}`);
            console.log(`  URL: http://localhost:${status.port}`);
          }
          // Wait for pending I/O before exit
          await new Promise((resolve) => setTimeout(resolve, 100));
          process.exitCode = 0;
        } else {
          console.log('✗ Daemon is not running');
          // Wait for pending I/O before exit
          await new Promise((resolve) => setTimeout(resolve, 100));
          process.exitCode = 1;
        }
        break;
      }

      case 'stop': {
        const forceStop = values['force'] === true;
        const stopped = await stopDaemon(forceStop);
        if (stopped) {
          console.log('✓ Daemon stopped');
          await new Promise((resolve) => setTimeout(resolve, 100));
          process.exitCode = 0;
        } else {
          console.log('✗ Daemon was not running');
          await new Promise((resolve) => setTimeout(resolve, 100));
          process.exitCode = 1;
        }
        break;
      }

      case 'init':
        await init();
        break;

      case 'doctor':
        await doctor();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
pi-bot ${VERSION}

Usage:
  pi-bot [serve|start]     Start the daemon (default)
  pi-bot open              Start daemon if needed and open web GUI
  pi-bot status            Check daemon status
  pi-bot stop              Stop the daemon
  pi-bot init              Initialize configuration
  pi-bot doctor            Check system health

Options:
  -c, --config <path>      Config file path
  -p, --port <port>        Server port (default: 8787)
  --no-browser            Don't open browser (with 'open' command)
  -h, --help              Show help
  -v, --version           Show version
  -f, --force             Force-stop any daemon on the port (with 'stop')
  --dev                   Development mode

Examples:
  pi-bot                   (starts daemon)
  pi-bot open              (opens web GUI)
  pi-bot open --no-browser (start without opening browser)
  pi-bot serve --port 8080
  pi-bot status
  pi-bot stop
  pi-bot doctor
  `);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
