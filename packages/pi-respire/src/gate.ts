import type { GateState, RespireConfig } from "./types.js";

export class RecallGate {
  private state: GateState = {
    status: "CLOSED",
    blockedCount: 0,
    turnHadRecall: false,
  };

  private readonly config: {
    firstTool: "block" | "warn" | "off";
    strictBatch: boolean;
    errorGate: "block" | "warn" | "off";
    settleRecall: "continue" | "warn" | "off";
    settleStore: "continue" | "warn" | "off";
    forceToolChoice: boolean;
    maxBlocks: number;
    extraRecallTools: string[];
  };
  private readonly extraRecallTools: Set<string>;

  constructor(config?: RespireConfig["gate"]) {
    this.config = {
      firstTool: config?.firstTool ?? "block",
      strictBatch: config?.strictBatch ?? true,
      errorGate: config?.errorGate ?? "block",
      settleRecall: config?.settleRecall ?? "continue",
      settleStore: config?.settleStore ?? "warn",
      forceToolChoice: config?.forceToolChoice ?? false,
      maxBlocks: config?.maxBlocks ?? 3,
      extraRecallTools: config?.extraRecallTools ?? [],
    };
    
    this.extraRecallTools = new Set([
      "respire_recall",
      ...(this.config.extraRecallTools ?? []),
    ]);
  }

  reset(): void {
    this.state = {
      status: "CLOSED",
      blockedCount: 0,
      turnHadRecall: false,
    };
  }

  isRecallTool(toolName: string, args?: any): boolean {
    if (this.extraRecallTools.has(toolName)) {
      return true;
    }

    if (toolName === "bash") {
      const command = typeof args === "object" && args?.command ? String(args.command) : "";
      const recallPattern = /^\s*rsrs(\s+--client-only)?(\s+--json)?\s+recall\b/;
      return recallPattern.test(command) && command.includes("--json");
    }

    return false;
  }

  checkFirstCall(toolName: string, toolArgs?: any): { allowed: boolean; reason?: string } {
    if (this.config.firstTool === "off" || this.state.status !== "CLOSED") {
      return { allowed: true };
    }

    if (this.isRecallTool(toolName, toolArgs)) {
      this.state.status = "PENDING";
      this.state.pendingRecallId = toolName;
      this.state.turnHadRecall = true;
      return { allowed: true };
    }

    this.state.blockedCount = (this.state.blockedCount ?? 0) + 1;
    const currentBlocks = this.state.blockedCount!;

    if (currentBlocks >= this.config.maxBlocks) {
      return {
        allowed: false,
        reason: `Recall gate: exceeded max blocks (${this.config.maxBlocks}). Session terminated.`,
      };
    }

    const reason = [
      "Respire recall gate: the first tool call in each turn MUST be respire_recall",
      `(equivalent to \`rsrs recall "<project + keywords>" --titles --json\`).`,
      "",
      `Please call respire_recall first, then call ${toolName}.`,
    ].join("\n");

    return {
      allowed: this.config.firstTool === "warn",
      reason,
    };
  }

  checkBatchCall(toolName: string, toolArgs?: any): { allowed: boolean; reason?: string } {
    if (!this.config.strictBatch || this.state.status !== "PENDING") {
      return { allowed: true };
    }

    if (this.isRecallTool(toolName, toolArgs)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Recall gate (strict batch): waiting for recall result. Other tools in this batch are blocked.",
    };
  }

  handleRecallResult(success: boolean): void {
    if (this.state.status === "PENDING") {
      this.state.status = "OPEN";
      if (!success) {
        this.state.recallFailed = true;
      }
    }
  }

  handleToolError(_toolName: string): void {
    if (this.config.errorGate === "block" && this.state.status === "OPEN") {
      this.state.status = "ERROR_GATE";
    }
  }

  checkAfterError(toolName: string, toolArgs?: any): { allowed: boolean; reason?: string } {
    if (this.state.status !== "ERROR_GATE") {
      return { allowed: true };
    }

    if (this.isRecallTool(toolName, toolArgs)) {
      this.state.status = "OPEN";
      return { allowed: true };
    }

    return {
      allowed: this.config.errorGate === "warn",
      reason: "Respire error gate: after a tool error, the next tool call should be respire_recall.",
    };
  }

  shouldRemindRecall(): boolean {
    return this.config.settleRecall === "continue" && !this.state.turnHadRecall;
  }

  getState(): GateState {
    return { ...this.state };
  }
}
