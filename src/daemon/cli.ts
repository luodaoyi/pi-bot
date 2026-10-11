#!/usr/bin/env node
/**
 * pi-bot CLI entrypoint
 */

import { parseArgs } from 'node:util';
import { serve } from './server/index.js';
import { init } from './commands/init.js';
import { doctor } from './commands/doctor.js';

const VERSION = '0.1.0';

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      config: { type: 'string', short: 'c' },
      dev: { type: 'boolean' },
    },
    allowPositionals: true,
  });

  if (values.version) {
    console.log(`pi-bot ${VERSION}`);
    process.exit(0);
  }

  const command = positionals[0];

  if (!command || values.help) {
    showHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'serve':
        await serve({
          configPath: values.config,
          dev: values.dev ?? false,
        });
        break;

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
  pi-bot serve [options]    Start the daemon
  pi-bot init              Initialize configuration
  pi-bot doctor            Check system health

Options:
  -c, --config <path>      Config file path
  -h, --help              Show help
  -v, --version           Show version
  --dev                   Development mode

Examples:
  pi-bot serve
  pi-bot serve --config ./config.toml
  pi-bot doctor
  `);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
