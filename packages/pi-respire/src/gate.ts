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
  pi.on('input', (event, _extCtx) => {
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
  pi.on('before_agent_start', (_event, _extCtx) => {
    ctx.setState({
      status: 'closed',
      recallAttempted: false,
      recallFailed: false,
      blockCount: 0,
      currentBatch: new Set(),
    });
  });

  // Check tool calls
  pi.on('tool_call', (event, _extCtx) => {
    const bootState = ctx.getBootState();
    const gateState = ctx.getState();

    // Skip gate if memory is off
    if (bootState?.mode === 'off' || options.gateMode === 'off') {
      return;
    }

    const isRecall = isRecallTool(event.toolName, event.input);

    // First tool: must be recall
    if (gateState.status === 'closed' && !isRecall) {
      const blockCount = gateState.blockCount + 1;

      ctx.setState({ blockCount });

      const reason =
        'Respire opening gate: The first tool call in this turn must be ' +
        '`respire_recall` (equivalent to `rsrs recall "<query>" --titles --json`). ' +
        `Please call respire_recall first, then call \`${event.toolName}\`.`;

      if (options.gateMode === 'block') {
        // Check if we've blocked too many times
        if (blockCount >= options.maxBlocks) {
          console.error(
            `Gate blocked ${blockCount} times, terminating to prevent loop`
          );
          return {
            block: true,
            reason: reason + '\n\n[Too many blocks, terminating turn]',
            terminate: true,
          };
        } else {
          return {
            block: true,
            reason,
          };
        }
      }

      if (options.gateMode === 'warn') {
        console.warn(reason);
      }
    }

    // Recall tool called
    if (isRecall) {
      ctx.setState({
        status: 'pending',
        recallAttempted: true,
        currentBatch: gateState.currentBatch.add(event.toolCallId ?? 'unknown'),
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
        return {
          block: true,
          reason:
            'Recall is still pending. Please wait for recall result before calling other tools.',
        };
      }
    }
  });

  // Handle tool results
  pi.on('tool_result', (event, _extCtx) => {
    const gateState = ctx.getState();

    if (gateState.currentBatch.has(event.toolCallId ?? '')) {
      // This is a recall result
      const failed = event.isError || false;

      ctx.setState({
        status: failed && options.errorGate !== 'off' ? 'error_gate' : 'open',
        recallFailed: failed,
        currentBatch: new Set(),
      });

      // Add failure note to result if needed (note: we can't modify event.result directly in tool_result hook)
      if (failed) {
        console.warn('Recall failed; agent should report this per policy');
      }
    }
  });

  // TODO: Check at turn end for missing recall
  // The agent_before_settle event requires special handling; commenting out for now
  // pi.on('agent_before_settle', (_event, _extCtx) => {
  //   const bootState = ctx.getBootState();
  //   const gateState = ctx.getState();
  //
  //   if (bootState?.mode === 'off' || options.settleRecall === 'off') {
  //     return;
  //   }
  //
  //   if (!gateState.recallAttempted) {
  //     const reminder = 'Reminder: You did not call respire_recall this turn...';
  //     console.warn(reminder);
  //   }
  // });
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
