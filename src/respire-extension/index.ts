/**
 * pi-respire: Pi extension for Respire memory system
 *
 * This extension provides:
 * - Boot injection: Loads Respire policy at session start
 * - Recall gate: Enforces "first tool must be recall" rule
 * - Memory tools: recall, remember, show, forget, etc.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createRespireExtension } from './extension.js';

// Default export for pi package loading
export default function (pi: ExtensionAPI) {
  const extension = createRespireExtension({
    port: parseInt(process.env['RSRS_RPC_PORT'] || '15169', 10),
    autostart: process.env['RSRS_NO_AUTOSTART'] !== '1',
  });
  
  return extension(pi);
}

// Named exports for programmatic use
export { createRespireExtension } from './extension.js';
export type { RespireExtensionOptions } from './types.js';
