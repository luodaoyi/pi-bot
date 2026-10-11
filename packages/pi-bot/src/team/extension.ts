import type { State } from "../store.js";
import type { Message, Question } from "@pi-bot/protocol";
import { randomUUID } from "node:crypto";

export interface TeamExtensionOptions {
  state: State;
  botId: string;
  onMessage: (message: Message) => Promise<void>;
  onQuestion: (question: Question) => Promise<void>;
}

const MAX_HOPS = 3;

export function teamExtension(options: TeamExtensionOptions) {
  const { state, botId, onMessage, onQuestion } = options;

  return (pi: any) => {
    pi.registerTool({
      name: "message_bot",
      description: "Send a message to another bot in the team. The target bot will receive and process it.",
      parameters: {
        type: "object",
        properties: {
          targetBotId: {
            type: "string",
            description: "ID of the bot to message",
          },
          content: {
            type: "string",
            description: "Message content",
          },
          expectReply: {
            type: "boolean",
            description: "Whether to wait for a reply",
            default: false,
          },
        },
        required: ["targetBotId", "content"],
      },
      async execute(args: any) {
        const { targetBotId, content, expectReply } = args;

        const targetBot = state.bots[targetBotId];
        if (!targetBot) {
          return {
            isError: true,
            content: `Bot ${targetBotId} not found`,
          };
        }

        const sender = state.bots[botId];
        if (!sender) {
          return {
            isError: true,
            content: "Sender bot not found",
          };
        }

        const message: Message = {
          id: randomUUID(),
          from: botId,
          fromName: sender.name,
          to: targetBotId,
          toName: targetBot.name,
          content,
          timestamp: Date.now(),
          hops: 0,
          expectReply: expectReply ?? false,
        };

        await onMessage(message);

        return {
          content: `Message sent to ${targetBot.name}`,
          structuredContent: { messageId: message.id },
        };
      },
    });

    pi.registerTool({
      name: "create_bot",
      description: "Create a new bot in the team",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Bot name",
          },
          role: {
            type: "string",
            description: "Bot role/specialty",
          },
          instructions: {
            type: "string",
            description: "System instructions for the bot",
          },
          model: {
            type: "string",
            description: "Model to use (default: deepseek/deepseek-chat)",
          },
        },
        required: ["name", "role", "instructions"],
      },
      async execute(args: any) {
        const { createBot } = await import("../store.js");
        
        const bot = createBot(state, {
          name: args.name,
          role: args.role,
          instructions: args.instructions,
          model: args.model ?? "deepseek/deepseek-chat",
        });

        return {
          content: `Bot created: ${bot.name} (${bot.id})`,
          structuredContent: bot,
        };
      },
    });

    pi.registerTool({
      name: "list_bots",
      description: "List all bots in the team",
      parameters: {
        type: "object",
        properties: {},
      },
      async execute() {
        const { listBots } = await import("../store.js");
        const bots = listBots(state);

        const lines = bots.map((b) => 
          `- ${b.name} (${b.id}): ${b.role}${b.main ? " [MAIN]" : ""}`
        );

        return {
          content: lines.join("\n"),
          structuredContent: bots,
        };
      },
    });

    pi.registerTool({
      name: "ask_user",
      description: "Ask the user a question and wait for their response",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to ask",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of suggested answers",
          },
        },
        required: ["question"],
      },
      async execute(args: any) {
        const question: Question = {
          id: randomUUID(),
          botId,
          question: args.question,
          options: args.options,
          timestamp: Date.now(),
          status: "pending",
        };

        await onQuestion(question);

        return {
          content: `Question sent to user. Question ID: ${question.id}`,
          structuredContent: question,
        };
      },
    });

    pi.on("tool_result", async (event: any) => {
      const toolName = event.tool?.name;
      const result = event.result;

      if (toolName === "message_bot" && result && !result.isError) {
        const messageId = result.structuredContent?.messageId;
        if (messageId) {
          console.log(`Message ${messageId} sent by bot ${botId}`);
        }
      }
      
      return undefined;
    });
  };
}

export function shouldBlockMessage(message: Message): { block: boolean; reason?: string } {
  if (message.hops >= MAX_HOPS) {
    return {
      block: true,
      reason: `Message exceeded max hops (${MAX_HOPS})`,
    };
  }

  return { block: false };
}

export function incrementHops(message: Message): Message {
  return {
    ...message,
    hops: (message.hops ?? 0) + 1,
  };
}
