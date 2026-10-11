#!/usr/bin/env node
/**
 * pi-bot CLI entrypoint
 */

import { parseArgs } from 'node:util';
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

const VERSION = '0.1.0';

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      config: { type: 'string', short: 'c' },
      dev: { type: 'boolean' },
      port: { type: 'string', short: 'p' },
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
        writePid(process.pid);
        writePort(port);
        await serve({
          configPath: values.config,
          dev: values.dev ?? false,
          port,
        });
        break;
      }

      case 'open': {
        const { port, started } = await ensureDaemon();
        if (started) {
          console.log(`✓ Daemon started on port ${port}`);
        } else {
          console.log(`✓ Daemon already running on port ${port}`);
        }
        const url = `http://localhost:${port}`;
        console.log(`Opening ${url}...`);
        openUrl(url);
        break;
      }

      case 'status': {
        const status = await getDaemonStatus();
        if (status.running) {
          console.log(`✓ Daemon is running (PID: ${status.pid}, port: ${status.port})`);
          process.exit(0);
        } else {
          console.log('✗ Daemon is not running');
          process.exit(1);
        }
      }

      case 'stop': {
        const stopped = await stopDaemon();
        if (stopped) {
          console.log('✓ Daemon stopped');
        } else {
          console.log('✗ Daemon was not running');
          process.exit(1);
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
  -h, --help              Show help
  -v, --version           Show version
  --dev                   Development mode

Examples:
  pi-bot                   (starts daemon)
  pi-bot open              (opens web GUI)
  pi-bot serve --port 8080
  pi-bot stop
  pi-bot doctor
  `);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
