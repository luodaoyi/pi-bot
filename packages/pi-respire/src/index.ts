import type { RespireConfig, RespireExtensionOptions, BootState } from "./types.js";
import { boot, formatBootSection } from "./boot.js";
import { RecallGate } from "./gate.js";
import { registerMemoryTools } from "./tools.js";

export function respireExtension(options: RespireExtensionOptions) {
  const { client, config } = options;
  
  return (pi: any) => {
    let bootState: BootState | undefined;
    let gate: RecallGate;

    pi.on("session_start", async () => {
      bootState = await boot(client, bootState);
      gate = new RecallGate(config?.gate);
      
      registerMemoryTools(pi, client, config, bootState.mode);
      
      if (options.mode === "tui") {
        pi.registerCommand({
          name: "/respire",
          description: "Respire memory status and control",
          async execute(args: string[]) {
            const subcommand = args[0];
            
            if (subcommand === "status") {
              return {
                content: [
                  `Mode: ${bootState?.mode}`,
                  `Runtime: ${bootState?.runtimeVersion ?? "unavailable"}`,
                  `Policy: ${config?.policy ?? "full"}`,
                  `Gate: ${gate.getState().status}`,
                ].join("\n"),
              };
            }
            
            if (subcommand === "reload") {
              bootState = await boot(client);
              return { content: "Respire config reloaded" };
            }
            
            return { content: "Usage: /respire status | reload" };
          },
        });
      }
    });

    pi.on("session_shutdown", async (_event: any) => {
      // Cleanup if needed
    });

    pi.on("before_agent_start", async (event: any) => {
      if (!bootState) {
        bootState = await boot(client);
      }
      
      const policySection = formatBootSection(bootState);
      
      if (!event.systemPromptOptions) {
        event.systemPromptOptions = {};
      }
      if (!event.systemPromptOptions.sections) {
        event.systemPromptOptions.sections = {};
      }
      
      event.systemPromptOptions.sections.respire_policy = policySection;
      
      return {
        systemPromptOptions: event.systemPromptOptions,
      } as any;
    });

    pi.on("input", async (_event: any) => {
      if (_event.source === "interactive" || _event.source === "rpc") {
        gate.reset();
      }
    });

    pi.on("tool_call", async (event: any) => {
      const toolName = event.tool?.name ?? "";
      const toolArgs = event.input;
      
      if (bootState?.mode === "off") {
        return;
      }

      const gateState = gate.getState();

      if (gateState.status === "ERROR_GATE") {
        const check = gate.checkAfterError(toolName, toolArgs);
        if (!check.allowed) {
          return {
            block: true,
            reason: check.reason,
          };
        }
      }

      if (gateState.status === "CLOSED") {
        const check = gate.checkFirstCall(toolName, toolArgs);
        if (!check.allowed) {
          return {
            block: true,
            reason: check.reason,
            terminate: (gateState.blockedCount ?? 0) >= (config?.gate?.maxBlocks ?? 3),
          };
        }
      }

      if (gateState.status === "PENDING" && config?.gate?.strictBatch !== false) {
        const check = gate.checkBatchCall(toolName, toolArgs);
        if (!check.allowed) {
          return {
            block: true,
            reason: check.reason,
          };
        }
      }
      
      return undefined;
    });

    pi.on("tool_result", async (event: any) => {
      const toolName = event.tool?.name ?? "";
      const result = event.result;
      
      if (gate.isRecallTool(toolName)) {
        gate.handleRecallResult(!result?.isError);
      }
      
      if (result?.isError) {
        gate.handleToolError(toolName);
      }
      
      return undefined;
    });

    pi.on("agent_before_settle", async (_event: any) => {
      if (bootState?.mode === "off") {
        return undefined;
      }

      if (gate.shouldRemindRecall()) {
        const reminder = [
          "",
          "Reminder: You did not call respire_recall this turn.",
          "Per Respire policy, every turn must start with recall.",
          "Please recall now before responding.",
        ].join("\n");

        return {
          entries: [
            {
              type: "custom",
              role: "system",
              content: reminder,
            },
          ],
          continue: config?.gate?.settleRecall === "continue",
        };
      }
      
      return undefined;
    });
  };
}

export async function createDefaultExtension(pi: any) {
  const { RespireClient } = await import("@pi-bot/respire-client");
  const client = new RespireClient();
  
  const config: RespireConfig = {
    port: Number(process.env.RSRS_RPC_PORT ?? "15169"),
    autostart: process.env.RSRS_NO_AUTOSTART !== "1",
    policy: "full",
  };

  return respireExtension({
    client,
    config,
    mode: "tui",
  })(pi);
}
