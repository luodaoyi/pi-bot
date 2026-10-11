/**
 * Register slash commands for pi-respire
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
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
  pi.registerCommand({
    name: 'respire',
    description: 'Show Respire memory system status',
    async execute() {
      const boot = ctx.getBootState();
      const gate = ctx.getGateState();

      if (!boot) {
        return 'Respire not initialized (session not started yet)';
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

      return status;
    },
  });

  // /boot (manually trigger boot reload)
  pi.registerCommand({
    name: 'boot',
    description: 'Reload Respire policy (for debugging)',
    async execute() {
      // This would require triggering session_start again
      // For now, just show current boot state
      const boot = ctx.getBootState();

      if (!boot) {
        return 'Boot state not available. Use at session start.';
      }

      return (
        `Boot timestamp: ${new Date(boot.timestamp).toISOString()}\n` +
        `Mode: ${boot.mode}\n` +
        `Policy loaded: ${boot.policyText.length > 0 ? 'Yes' : 'No'}`
      );
    },
  });
}
