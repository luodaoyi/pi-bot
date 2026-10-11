import type { RespireClient } from "@pi-bot/respire-client";
import type { RespireConfig } from "./types.js";

export function registerMemoryTools(
  pi: any,
  client: RespireClient,
  _config?: RespireConfig,
  mode?: "normal" | "readonly" | "off" | "unavailable",
) {
  // Scope variables reserved for future per-bot/team memory isolation
  // const scope = config?.scope;
  // const teamProject = scope?.teamProject ?? "";
  // const botProjectPrefix = scope?.botProjectPrefix ?? "pi-bot/";

  if (mode === "off") {
    return;
  }

  pi.registerTool({
    name: "respire_recall",
    description: "Recall relevant memories from Respire. This is the FIRST tool you must call each turn.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (project name + key concepts)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return",
          default: 20,
        },
        titles: {
          type: "boolean",
          description: "Return only titles (faster)",
          default: true,
        },
        project: {
          type: "string",
          description: "Filter by project scope",
        },
        mode: {
          type: "string",
          enum: ["fast", "quality"],
          description: "Recall mode",
        },
      },
      required: ["query"],
    },
    promptGuidelines: "ALWAYS call this tool FIRST in each turn before any other tool calls.",
    async execute(args: any) {
      try {
        const result = await client.recall(args.query, {
          limit: args.limit,
          titles: args.titles,
          project: args.project,
          mode: args.mode,
        });

        if (result.count === 0) {
          return {
            content: "No memories found.",
            structuredContent: result,
          };
        }

        const lines = result.items?.map((item) => 
          `- [${item.id.slice(0, 8)}] ${item.title} (score: ${item.score.toFixed(3)})`
        ) ?? [];

        return {
          content: [
            `Found ${result.count} memories:`,
            ...lines,
            "",
            "Use respire_show to read full content.",
          ].join("\n"),
          structuredContent: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            "recall failed:",
            message,
            "",
            "Per Respire policy, you MUST write at the start of your response:",
            `"recall failed: ${message}"`,
          ].join("\n"),
        };
      }
    },
  });

  pi.registerTool({
    name: "respire_show",
    description: "Show full content of a memory entry by ID",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Memory entry ID (full or 8-char prefix)",
        },
      },
      required: ["id"],
    },
    async execute(args: any) {
      try {
        const entry = await client.show(args.id);
        return {
          content: [
            `# ${entry.title ?? "Untitled"}`,
            "",
            entry.content,
            "",
            `ID: ${entry.id}`,
            entry.created_at ? `Created: ${entry.created_at}` : "",
            entry.importance ? `Importance: ${entry.importance}` : "",
            entry.parent_id ? `Parent: ${entry.parent_id}` : "",
          ].join("\n"),
          structuredContent: entry,
        };
      } catch (error) {
        return {
          isError: true,
          content: `Failed to show memory: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  if (mode !== "readonly") {
    pi.registerTool({
      name: "respire_remember",
      description: "Store a new memory. Respire judge-then-store: returns candidates if similar entries exist.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Memory content (Cause + Action + Effect format preferred)",
          },
          title: {
            type: "string",
            description: "Brief title",
          },
          importance: {
            type: "string",
            enum: ["important", "trivial"],
            description: "Importance level (important → main memory, trivial → diary)",
            default: "trivial",
          },
          parent: {
            type: "string",
            description: "Parent entry ID (for hierarchical organization)",
          },
          project: {
            type: "string",
            description: "Project scope",
          },
          type: {
            type: "string",
            description: "Memory type (context, decision, preference, task, etc.)",
          },
          force: {
            type: "boolean",
            description: "Force store even if candidates exist",
            default: false,
          },
        },
        required: ["content", "title"],
      },
      async execute(args: any) {
        try {
          const result = await client.remember(args.content, {
            title: args.title,
            importance: args.importance,
            parent: args.parent,
            project: args.project,
            type: args.type,
            force: args.force,
          });

          if (result.status === "skip" && result.candidates) {
            return {
              content: [
                "Candidates found (not written):",
                ...result.candidates.map((c) => `- [${c.id.slice(0, 8)}] ${c.title ?? ""}`),
                "",
                "Choose action: edit > merge > attach > force store (--force)",
                "Not stored ≠ remembered. Must explicitly store.",
              ].join("\n"),
              structuredContent: result,
            };
          }

          return {
            content: `Memory stored: ${result.id ?? ""}`,
            structuredContent: result,
          };
        } catch (error) {
          return {
            isError: true,
            content: `Failed to store memory: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });

    pi.registerTool({
      name: "respire_forget",
      description: "Delete a memory entry (tombstone, propagates via sync)",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Memory entry ID to forget",
          },
        },
        required: ["id"],
      },
      async execute(args: any) {
        try {
          await client.forget(args.id);
          return {
            content: `Memory ${args.id} forgotten.`,
          };
        } catch (error) {
          return {
            isError: true,
            content: `Failed to forget memory: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    });
  }

  pi.registerTool({
    name: "respire_list",
    description: "List recent memory entries",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max entries to return",
          default: 10,
        },
      },
    },
    async execute(args: any) {
      try {
        const entries = await client.list({ limit: args.limit });
        return {
          content: entries
            .map((e) => `- [${e.id.slice(0, 8)}] ${e.title ?? e.content.slice(0, 50)}`)
            .join("\n"),
          structuredContent: entries,
        };
      } catch (error) {
        return {
          isError: true,
          content: `Failed to list memories: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

  pi.registerTool({
    name: "respire_diary",
    description: "List recent diary entries (trivial importance)",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max entries to return",
          default: 10,
        },
      },
    },
    async execute(args: any) {
      try {
        const entries = await client.diary({ limit: args.limit });
        return {
          content: entries
            .map((e) => `- [${e.id.slice(0, 8)}] ${e.title ?? e.content.slice(0, 50)}`)
            .join("\n"),
          structuredContent: entries,
        };
      } catch (error) {
        return {
          isError: true,
          content: `Failed to list diary: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
