/**
 * Pi extension /pi-bot slash command
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  ensureDaemon,
  getDaemonStatus,
  stopDaemon,
  openUrl,
} from '#shared/daemon-manager.js';

export function registerPiBotCommands(pi: ExtensionAPI): void {
  pi.registerCommand('pi-bot', {
    description: 'Manage pi-bot daemon (open|status|stop)',
    handler: async (args: string, _ctx: any) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0] || 'open';

      try {
        switch (subcommand) {
          case 'start':
          case 'serve':
          case 'open': {
            const { port, started, pid } = await ensureDaemon();
            
            if (started) {
              console.log(`✓ Pi-bot daemon started (PID: ${pid}, port: ${port})`);
            } else {
              console.log(`✓ Pi-bot daemon already running on port ${port}`);
            }
            
            const url = `http://localhost:${port}`;
            openUrl(url);
            
            console.log(`Opening ${url} in your browser...`);
            break;
          }

          case 'status': {
            const status = await getDaemonStatus();
            if (status.running) {
              console.log(`✓ Pi-bot daemon is running (PID: ${status.pid}, port: ${status.port})`);
            } else {
              console.log('✗ Pi-bot daemon is not running');
            }
            break;
          }

          case 'stop': {
            const stopped = await stopDaemon();
            if (stopped) {
              console.log('✓ Pi-bot daemon stopped');
            } else {
              console.log('✗ Pi-bot daemon was not running');
            }
            break;
          }

          default: {
            console.log(
              `Unknown subcommand: ${subcommand}\n\n` +
              'Available commands:\n' +
              '  /pi-bot [open]  - Start daemon and open web GUI (default)\n' +
              '  /pi-bot status  - Check daemon status\n' +
              '  /pi-bot stop    - Stop the daemon'
            );
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });
}
