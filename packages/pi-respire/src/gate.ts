/**
 * Recall gate: Enforce "first tool must be recall" rule
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { RespireClient } from '@pi-bot/respire-client';
import type { RespireExtensionOptions, BootState, GateState } from './types.js';

interface GateContext {
  getState: () => GateState;
  setState: (updates: Partial<GateState>) => void;
  getBootState: () => BootState | null;
}

export function setupGate(
  pi: ExtensionAPI,
  _client: RespireClient,
  options: Required<RespireExtensionOptions>,
  ctx: GateContext
) {
  // Reset gate on new user input
  pi.on('input', (event) => {
    if (event.source === 'interactive' || event.source === 'rpc') {
      ctx.setState({
        status: 'closed',
        recallAttempted: false,
        recallFailed: false,
        blockCount: 0,
        currentBatch: new Set(),
      });
    }
  });

  // Also reset at agent start
  pi.on('before_agent_start', () => {
    ctx.setState({
      status: 'closed',
      recallAttempted: false,
      recallFailed: false,
      blockCount: 0,
      currentBatch: new Set(),
    });
  });

  // Check tool calls
  pi.on('tool_call', (event) => {
    const bootState = ctx.getBootState();
    const gateState = ctx.getState();

    // Skip gate if memory is off
    if (bootState?.mode === 'off' || options.gateMode === 'off') {
      return;
    }

    const isRecall = isRecallTool(event.tool.name, event.input);

    // First tool: must be recall
    if (gateState.status === 'closed' && !isRecall) {
      const blockCount = gateState.blockCount + 1;

      ctx.setState({ blockCount });

      const reason =
        'Respire opening gate: The first tool call in this turn must be ' +
        '`respire_recall` (equivalent to `rsrs recall "<query>" --titles --json`). ' +
        `Please call respire_recall first, then call \`${event.tool.name}\`.`;

      if (options.gateMode === 'block') {
        // Check if we've blocked too many times
        if (blockCount >= options.maxBlocks) {
          event.ctx.logger?.error(
            `Gate blocked ${blockCount} times, terminating to prevent loop`
          );
          event.block = true;
          event.reason = reason + '\n\n[Too many blocks, terminating turn]';
          // TODO: How to actually terminate the turn in pi?
        } else {
          event.block = true;
          event.reason = reason;
        }
        return;
      }

      if (options.gateMode === 'warn') {
        event.ctx.logger?.warn(reason);
      }
    }

    // Recall tool called
    if (isRecall) {
      ctx.setState({
        status: 'pending',
        recallAttempted: true,
        currentBatch: gateState.currentBatch.add(event.id ?? 'unknown'),
      });
    }

    // In strict batch mode, block non-recall tools while recall is pending
    if (
      options.strictBatch &&
      gateState.status === 'pending' &&
      !isRecall &&
      gateState.currentBatch.size > 0
    ) {
      if (options.gateMode === 'block') {
        event.block = true;
        event.reason =
          'Recall is still pending. Please wait for recall result before calling other tools.';
      }
    }
  });

  // Handle tool results
  pi.on('tool_result', (event) => {
    const gateState = ctx.getState();

    if (gateState.currentBatch.has(event.toolCallId ?? '')) {
      // This is a recall result
      const failed = event.result.isError || false;

      ctx.setState({
        status: failed && options.errorGate !== 'off' ? 'error_gate' : 'open',
        recallFailed: failed,
        currentBatch: new Set(),
      });

      // Add failure note to result if needed
      if (failed && event.result.content) {
        const note =
          '\n\n' +
          '[Recall failed: ' +
          (event.result.content.toString() || 'unknown error') +
          ']\n' +
          'Per Respire policy, you must report this failure in your response.';

        event.result.content = (event.result.content.toString() || '') + note;
      }
    }
  });

  // Check at turn end for missing recall
  pi.on('agent_before_settle', (event) => {
    const bootState = ctx.getBootState();
    const gateState = ctx.getState();

    // Skip if memory is off
    if (bootState?.mode === 'off' || options.settleRecall === 'off') {
      return;
    }

    // If no recall was attempted, remind once
    if (!gateState.recallAttempted) {
      const reminder =
        'Reminder: You did not call `respire_recall` this turn. ' +
        'Per Respire policy, every turn must start with recall. ' +
        'Please recall now before responding.';

      if (options.settleRecall === 'continue') {
        event.continue = true;
        event.entries = [
          {
            role: 'user',
            content: reminder,
          },
        ];
      } else {
        event.ctx.logger?.warn(reminder);
      }
    }
  });
}

function isRecallTool(toolName: string, input: unknown): boolean {
  // Check for respire_recall tool
  if (toolName === 'respire_recall') {
    return true;
  }

  // Check for bash commands that call rsrs recall
  if (toolName === 'bash' && typeof input === 'object' && input !== null) {
    const cmd = (input as { command?: string }).command;
    if (cmd && /^\s*rsrs(\s+--client-only)?(\s+--json)?\s+recall\b/.test(cmd)) {
      // Must have --json flag
      return cmd.includes('--json');
    }
  }

  // Check for MCP respire recall (configurable extra tools)
  // This would need to be added from options
  return false;
}
