/**
 * Register slash commands for pi-respire
 */

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { RespireClient } from '@pi-bot/respire-client';
import type { RespireExtensionOptions, BootState, GateState } from './types.js';

interface CommandContext {
  getBootState: () => BootState | null;
  getGateState: () => GateState;
}

export function registerCommands(
  pi: ExtensionAPI,
  _client: RespireClient,
  _options: Required<RespireExtensionOptions>,
  ctx: CommandContext
) {
  // /respire status
  pi.registerCommand('respire', {
    description: 'Show Respire memory system status',
    handler: async (_args: string, _extCtx: ExtensionCommandContext) => {
      const boot = ctx.getBootState();
      const gate = ctx.getGateState();

      if (!boot) {
        console.log('Respire not initialized (session not started yet)');
        return;
      }

      let status = `# Respire Status\n\n`;
      status += `**Mode**: ${boot.mode}\n`;
      status += `**Version**: ${boot.respireVersion ?? 'unknown'}\n`;
      status += `**Gate**: ${gate.status}\n`;

      if (gate.recallAttempted) {
        status += `**Recall Attempted**: Yes${gate.recallFailed ? ' (failed)' : ''}\n`;
      }

      if (gate.blockCount > 0) {
        status += `**Blocks**: ${gate.blockCount}\n`;
      }

      console.log(status);
    },
  });

  // /boot (manually trigger boot reload)
  pi.registerCommand('boot', {
    description: 'Reload Respire policy (for debugging)',
    handler: async (_args: string, _extCtx: ExtensionCommandContext) => {
      // This would require triggering session_start again
      // For now, just show current boot state
      const boot = ctx.getBootState();

      if (!boot) {
        console.log('Boot state not available. Use at session start.');
        return;
      }

      const message =
        `Boot timestamp: ${new Date(boot.timestamp).toISOString()}\n` +
        `Mode: ${boot.mode}\n` +
        `Policy loaded: ${boot.policyText.length > 0 ? 'Yes' : 'No'}`;

      console.log(message);
    },
  });
}
