/**
 * Usage tracking extension for pi agent
 * Records token usage and cost from pi message events
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { UsageTracker } from '../usage/index.js';

export interface UsageExtensionOptions {
  usage: UsageTracker;
  getCurrentBotId: () => string;
  getSessionId: () => string;
}

export function createUsageExtension(options: UsageExtensionOptions) {
  return (pi: ExtensionAPI) => {
    const { usage, getCurrentBotId, getSessionId } = options;

    // Track usage from message_end events
    pi.on('message_end', async (event) => {
      // Only track assistant messages (model responses)
      if (event.message.role !== 'assistant') {
        return {};
      }

      try {
        const usageData = event.message.usage;
        if (!usageData) {
          return {};
        }

        const botId = getCurrentBotId();
        const sessionId = getSessionId();

        // Extract provider and model from message metadata
        const provider = (event.message as any).provider || 'unknown';
        const model = (event.message as any).model || 'unknown';

        // Determine kind based on context (default to 'turn')
        // Could be enhanced to detect 'memory', 'steward', 'summary', etc.
        const kind = 'turn';

        // Usage fields from pi-ai types
        await usage.record(
          botId,
          sessionId,
          provider,
          model,
          kind,
          usageData.input || 0,
          usageData.cacheRead || 0,
          usageData.cacheWrite || 0,
          usageData.output || 0,
          (usageData as any).cost // cost may not be in the base Usage type
        );
      } catch (error) {
        console.error('Failed to record usage:', error);
      }

      return {};
    });
  };
}
