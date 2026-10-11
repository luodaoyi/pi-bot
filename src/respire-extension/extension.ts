/**
 * Main extension factory for pi-respire
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { RespireClient } from '#respire-client/index.js';
import type { RespireExtensionOptions, BootState, GateState } from './types.js';
import { setupBoot } from './boot.js';
import { setupGate } from './gate.js';
import { registerMemoryTools } from './tools.js';
import { registerCommands } from './commands.js';
import { registerPiBotCommands } from './pi-bot-commands.js';

const DEFAULT_OPTIONS: Required<RespireExtensionOptions> = {
  port: 15169,
  autostart: true,
  scope: '',
  gateMode: 'block',
  strictBatch: true,
  errorGate: 'block',
  settleRecall: 'continue',
  settleStore: 'warn',
  maxBlocks: 3,
};

export function createRespireExtension(options: RespireExtensionOptions = {}) {
  return (pi: ExtensionAPI) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const client = new RespireClient({
      port: opts.port,
      autostart: opts.autostart,
    });

    // Per-session state (stored in extension closure)
    let bootState: BootState | null = null;
    let gateState: GateState = {
      status: 'closed',
      recallAttempted: false,
      recallFailed: false,
      blockCount: 0,
      currentBatch: new Set(),
    };

    // Setup components
    setupBoot(pi, client, opts, (state) => {
      bootState = state;
    });

    setupGate(pi, client, opts, {
      getState: () => gateState,
      setState: (updates) => {
        gateState = { ...gateState, ...updates };
      },
      getBootState: () => bootState,
    });

    registerMemoryTools(pi, client, opts, {
      getBootState: () => bootState,
      getGateState: () => gateState,
    });

    registerCommands(pi, client, opts, {
      getBootState: () => bootState,
      getGateState: () => gateState,
    });

    registerPiBotCommands(pi);
  };
}
