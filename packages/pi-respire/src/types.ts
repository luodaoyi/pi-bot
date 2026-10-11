import type { RespireClient } from "@pi-bot/respire-client";

export type MemoryMode = "normal" | "readonly" | "off" | "unavailable";

export interface RespireConfig {
  port?: number;
  autostart?: boolean;
  policy?: "full" | "lite";
  reanchorTokens?: number;
  gate?: {
    firstTool?: "block" | "warn" | "off";
    strictBatch?: boolean;
    errorGate?: "block" | "warn" | "off";
    settleRecall?: "continue" | "warn" | "off";
    settleStore?: "continue" | "warn" | "off";
    forceToolChoice?: boolean;
    maxBlocks?: number;
    extraRecallTools?: string[];
  };
  scope?: {
    teamProject?: string;
    botProjectPrefix?: string;
  };
}

export interface RespireExtensionOptions {
  client: RespireClient;
  config?: RespireConfig;
  scope?: string;
  mode?: "host" | "tui";
}

export interface GateState {
  status: "CLOSED" | "PENDING" | "OPEN" | "ERROR_GATE";
  recallFailed?: boolean;
  blockedCount?: number;
  turnHadRecall?: boolean;
  pendingRecallId?: string;
}

export interface BootState {
  runtimeVersion?: string;
  policyHash?: string;
  mode: MemoryMode;
  policy?: string;
  readonly?: boolean;
  memoryOff?: boolean;
}
