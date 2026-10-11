/**
 * Boot logic: Load Respire policy at session start
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { RespireClient } from '@pi-bot/respire-client';
import type { RespireExtensionOptions, BootState } from './types.js';

export function setupBoot(
  pi: ExtensionAPI,
  client: RespireClient,
  _options: Required<RespireExtensionOptions>,
  onBootStateChange: (state: BootState) => void
) {
  // Load policy and configuration at session start
  pi.on('session_start', async (_event, _ctx) => {
    try {
      // Check Respire health
      const health = await client.ensureUp();

      // Get agent configuration (memory_off, readonly, etc.)
      const config = await client.agentConfig();

      // Determine mode
      let mode: BootState['mode'] = 'normal';
      if (config.memory_off) {
        mode = 'off';
      } else if (config.readonly) {
        mode = 'readonly';
      }

      // Load full policy text
      let policyText = '';
      if (mode !== 'off') {
        try {
          policyText = await client.prompt();
        } catch (error) {
          console.warn('Failed to load Respire policy:', error);
          mode = 'unavailable';
        }
      }

      const bootState: BootState = {
        policyText,
        mode,
        respireVersion: health.bin,
        timestamp: Date.now(),
      };

      onBootStateChange(bootState);

      console.info(`Respire boot complete: mode=${mode}, version=${health.bin}`);
    } catch (error) {
      const bootState: BootState = {
        policyText: '',
        mode: 'unavailable',
        timestamp: Date.now(),
      };

      onBootStateChange(bootState);

      console.warn('Respire unavailable:', error);
    }
  });

  // Inject policy into system prompt before each agent start
  pi.on('before_agent_start', (event, _ctx) => {
    const bootState = onBootStateChange as unknown as () => BootState | null;
    const state = (bootState as () => BootState | null)();

    if (!state) {
      return;
    }

    // Add respire_policy section based on mode
    if (state.mode === 'off') {
      event.systemPromptOptions.sections = {
        ...event.systemPromptOptions.sections,
        respire_policy:
          '# Memory Status\n\n' +
          'Memory system is currently disabled (mode: off). ' +
          'You may answer directly without checking or storing memories.\n',
      };
      return;
    }

    if (state.mode === 'unavailable') {
      event.systemPromptOptions.sections = {
        ...event.systemPromptOptions.sections,
        respire_policy:
          '# Memory Status\n\n' +
          'Respire memory system is unavailable. ' +
          'When you attempt to recall, the tool will fail. ' +
          'You must still call respire_recall as the first tool (per policy), ' +
          'then report the failure in your response.\n',
      };
      return;
    }

    // Normal or readonly mode: inject full policy
    let content = `# Respire Memory Policy\n\n${state.policyText}\n\n`;

    // Add pi-bot addendum
    content += '## Tool Mapping\n\n';
    content +=
      'The following tools are available. Each tool internally calls `rsrs <command> --json`:\n\n';
    content += '- `respire_recall` → `rsrs recall <query> --titles --json`\n';
    content += '- `respire_show` → `rsrs show <id> --json`\n';
    content += '- `respire_remember` → `rsrs remember <content> --title <title> --json`\n';
    content += '- `respire_forget` → `rsrs forget <id> --json`\n';
    content += '- `respire_list` → `rsrs list --json`\n';
    content += '- `respire_diary` → `rsrs diary --limit <n> --json`\n\n';

    content += '## Opening Gate\n\n';
    content +=
      'The first tool call in each turn MUST be `respire_recall`. ' +
      'This rule is mechanically enforced by pi-bot.\n\n';

    if (state.mode === 'readonly') {
      content += '## Readonly Mode\n\n';
      content +=
        'This is a readonly memory space. You can recall and show entries, ' +
        'but remember/forget/update operations are disabled.\n\n';
    }

    event.systemPromptOptions.sections = {
      ...event.systemPromptOptions.sections,
      respire_policy: content,
    };
  });
}
