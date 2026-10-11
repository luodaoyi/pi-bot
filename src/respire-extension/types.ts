/**
 * Types for pi-respire extension
 */

export interface RespireExtensionOptions {
  port?: number;
  autostart?: boolean;
  scope?: string; // Default project/scope for this bot
  gateMode?: 'block' | 'warn' | 'off';
  strictBatch?: boolean; // Block non-recall tools until recall result returns
  errorGate?: 'block' | 'warn' | 'off';
  settleRecall?: 'continue' | 'warn' | 'off';
  settleStore?: 'warn' | 'off';
  maxBlocks?: number; // Max consecutive blocks before terminating
}

export interface BootState {
  policyText: string;
  mode: 'normal' | 'readonly' | 'off' | 'unavailable';
  respireVersion?: string;
  timestamp: number;
}

export interface GateState {
  status: 'closed' | 'pending' | 'open' | 'error_gate';
  recallAttempted: boolean;
  recallFailed: boolean;
  blockCount: number;
  currentBatch: Set<string>; // Tool call IDs in current batch
}
