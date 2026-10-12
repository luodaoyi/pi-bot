/**
 * 把 pibot_* 注册为 SDK customTools，并注入系统提示
 */

import { Type } from '@sinclair/typebox';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { executePibotTool } from './tools.js';
import { buildPibotSystemPromptFromCtx } from './prompt.js';
import type { PibotHost, PibotToolContext } from './types.js';

function sdkResult(result: { text: string; details?: unknown; isError?: boolean }) {
  return {
    content: [{ type: 'text' as const, text: result.text }],
    details: result.details,
    isError: result.isError,
  };
}

function define(
  name: string,
  label: string,
  description: string,
  parameters: ToolDefinition['parameters'],
  ctx: PibotToolContext
): ToolDefinition {
  return {
    name,
    label,
    description,
    parameters,
    promptSnippet: description,
    async execute(_id, params) {
      const result = await executePibotTool(name, (params ?? {}) as Record<string, unknown>, ctx);
      return sdkResult(result);
    },
  };
}

export function createPibotToolDefinitions(ctx: PibotToolContext): ToolDefinition[] {
  return [
    define(
      'pibot_list_bots',
      'List bots',
      'List every bot on this pi-bot team (id, name, role) and visible group chats.',
      Type.Object({}),
      ctx
    ),
    define(
      'pibot_create_bot',
      'Create bot',
      'Main bot only. Create a teammate bot. It appears in the sidebar.',
      Type.Object({
        name: Type.String({ description: 'Short display name' }),
        role: Type.String({ description: 'Role label' }),
        instructions: Type.String({ description: 'What this bot should do' }),
        model: Type.Optional(Type.String({ description: 'provider/id, only if the user named one' })),
      }),
      ctx
    ),
    define(
      'pibot_list_sessions',
      'List sessions',
      'List chat sessions for a bot (defaults to yourself).',
      Type.Object({
        botId: Type.Optional(Type.String({ description: 'Bot id or name' })),
      }),
      ctx
    ),
    define(
      'pibot_create_session',
      'Create session',
      'Create a new session (optionally on another bot). If initialPrompt is set, that prompt runs in the background and you get sessionId immediately — then use pibot_get_session_result.',
      Type.Object({
        botId: Type.Optional(Type.String({ description: 'Target bot id or name; default = you' })),
        name: Type.Optional(Type.String({ description: 'Session title' })),
        initialPrompt: Type.Optional(
          Type.String({ description: 'Research brief to run in the new session in the background' })
        ),
      }),
      ctx
    ),
    define(
      'pibot_send_to_session',
      'Send to session',
      'Send a message to another session. By default does not wait; set awaitReply true to wait.',
      Type.Object({
        sessionId: Type.Optional(Type.String({ description: 'Target session id; default = that bot\'s active session' })),
        botId: Type.Optional(Type.String({ description: 'Target bot id or name' })),
        message: Type.String({ description: 'Self-contained message' }),
        awaitReply: Type.Optional(Type.Boolean({ description: 'Wait for the assistant reply (default false)' })),
        timeoutMs: Type.Optional(Type.Number({ description: 'Wait timeout in ms' })),
      }),
      ctx
    ),
    define(
      'pibot_ask_bot',
      'Ask bot',
      'Send a message to another bot and wait for its reply (hop-limited).',
      Type.Object({
        bot: Type.Optional(Type.String({ description: 'Bot id or name' })),
        botId: Type.Optional(Type.String({ description: 'Bot id or name (alias of bot)' })),
        sessionId: Type.Optional(Type.String({ description: 'Specific session; default = active' })),
        message: Type.String({ description: 'Question or brief' }),
        awaitReply: Type.Optional(Type.Boolean({ description: 'Default true' })),
        timeoutMs: Type.Optional(Type.Number({ description: 'Wait timeout in ms' })),
      }),
      ctx
    ),
    define(
      'pibot_get_session_result',
      'Get session result',
      'Return the latest assistant reply of a session. Optionally wait with waitMs.',
      Type.Object({
        sessionId: Type.String({ description: 'Session id from pibot_create_session' }),
        botId: Type.Optional(Type.String({ description: 'Bot id or name if not yours' })),
        waitMs: Type.Optional(Type.Number({ description: 'Wait this many ms for a reply' })),
        timeoutMs: Type.Optional(Type.Number({ description: 'Alias of waitMs' })),
      }),
      ctx
    ),
    define(
      'pibot_create_group',
      'Create group',
      'Main bot only. Create a group chat with named members.',
      Type.Object({
        name: Type.String({ description: 'Group name' }),
        members: Type.Optional(
          Type.Union([Type.Array(Type.String()), Type.String()], {
            description: 'Bot names or ids (you are added automatically)',
          })
        ),
        notice: Type.Optional(Type.String()),
        mode: Type.Optional(Type.Union([Type.Literal('everyone'), Type.Literal('admin')])),
      }),
      ctx
    ),
    define(
      'pibot_post_group',
      'Post to group',
      'Post a message into a group chat as yourself.',
      Type.Object({
        group: Type.Optional(Type.String({ description: 'Group name or id' })),
        groupId: Type.Optional(Type.String({ description: 'Group id' })),
        message: Type.String(),
      }),
      ctx
    ),
    define(
      'pibot_schedule_task',
      'Schedule task',
      'Create a cron task. Timezone defaults to the user\'s settings timezone (not UTC). Store name and message separately.',
      Type.Object({
        cron: Type.Optional(Type.String({ description: 'Cron expression, e.g. "0 9 * * *"' })),
        time: Type.Optional(Type.String({ description: 'Alias of cron' })),
        message: Type.String({ description: 'Prompt delivered when the task fires' }),
        name: Type.Optional(Type.String({ description: 'Task display name' })),
        botId: Type.Optional(Type.String({ description: 'Target bot; default = you' })),
        timezone: Type.Optional(Type.String({ description: 'IANA tz; default = user settings timezone' })),
      }),
      ctx
    ),
    define(
      'pibot_list_tasks',
      'List tasks',
      'List scheduled tasks (name, timezone, next run).',
      Type.Object({
        botId: Type.Optional(Type.String()),
      }),
      ctx
    ),
    define(
      'pibot_secret_list',
      'List secret names',
      'List secret names only (never values).',
      Type.Object({}),
      ctx
    ),
  ];
}

export function createPibotPromptExtension(getCtx: () => PibotToolContext | undefined) {
  return (pi: ExtensionAPI) => {
    pi.on('before_agent_start', async (event) => {
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const section = await buildPibotSystemPromptFromCtx(ctx);
        event.systemPromptOptions.sections = {
          ...event.systemPromptOptions.sections,
          pibot_team: section,
        };
      } catch (error) {
        console.warn('[pibot] failed to inject system prompt:', error);
      }
    });
  };
}

export function createPibotContext(host: PibotHost, currentBotId: string, currentSessionId: string, currentHop: number): PibotToolContext {
  return {
    store: host.store,
    pool: host.pool,
    scheduler: host.scheduler,
    groups: host.groups,
    secrets: host.secrets,
    getTimezone: host.getTimezone,
    currentBotId,
    currentSessionId,
    currentHop,
  };
}
