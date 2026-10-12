/**
 * pi-bot 自管理工具实现（与 SDK 解耦，便于单测）
 */

import type { BotConfig, ChatSessionSummary } from '#shared/index.js';
import type { GroupCreateRequest } from '../groups/types.js';
import {
  DEFAULT_ASK_TIMEOUT_MS,
  MAX_HOPS,
  parseModelRef,
  resolveBot,
  toolErr,
  toolOk,
  type PibotToolContext,
  type PibotToolResult,
} from './types.js';

export const PIBOT_TOOL_NAMES = [
  'pibot_list_bots',
  'pibot_create_bot',
  'pibot_list_sessions',
  'pibot_create_session',
  'pibot_send_to_session',
  'pibot_ask_bot',
  'pibot_get_session_result',
  'pibot_create_group',
  'pibot_post_group',
  'pibot_schedule_task',
  'pibot_list_tasks',
  'pibot_secret_list',
] as const;

export type PibotToolName = (typeof PIBOT_TOOL_NAMES)[number];

function assertHop(ctx: PibotToolContext): PibotToolResult | null {
  if (ctx.currentHop >= MAX_HOPS) {
    return toolErr(
      `消息跳数已达上限（${ctx.currentHop} >= ${MAX_HOPS}）。请停止互相呼叫，直接向用户汇报。`
    );
  }
  return null;
}

function nextHop(ctx: PibotToolContext): number {
  return ctx.currentHop + 1;
}

function nameList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function summarizeSession(session: ChatSessionSummary): string {
  const name = session.name || session.id;
  const active = session.isActive ? ' · 当前' : '';
  return `- ${name} (${session.id})${active} · ${session.messageCount} 条消息 · ${session.updatedAt}`;
}

export async function executePibotTool(
  name: string,
  args: Record<string, unknown>,
  ctx: PibotToolContext
): Promise<PibotToolResult> {
  switch (name) {
    case 'pibot_list_bots':
      return listBots(ctx);
    case 'pibot_create_bot':
      return createBot(args, ctx);
    case 'pibot_list_sessions':
      return listSessions(args, ctx);
    case 'pibot_create_session':
      return createSession(args, ctx);
    case 'pibot_send_to_session':
      return sendToSession(args, ctx);
    case 'pibot_ask_bot':
      return askBot(args, ctx);
    case 'pibot_get_session_result':
      return getSessionResult(args, ctx);
    case 'pibot_create_group':
      return createGroup(args, ctx);
    case 'pibot_post_group':
      return postGroup(args, ctx);
    case 'pibot_schedule_task':
      return scheduleTask(args, ctx);
    case 'pibot_list_tasks':
      return listTasks(args, ctx);
    case 'pibot_secret_list':
      return secretList(ctx);
    default:
      return toolErr(`未知工具：${name}`);
  }
}

async function listBots(ctx: PibotToolContext): Promise<PibotToolResult> {
  const bots = await ctx.store.listBots();
  const groups = ctx.groups.listGroups();
  const lines = bots.map((bot) => {
    const tags = [
      bot.role,
      bot.model ? `model ${bot.model.provider}/${bot.model.id}` : 'model follow-pi',
      bot.isMain ? 'Main' : '',
      bot.id === ctx.currentBotId ? 'you' : '',
    ]
      .filter(Boolean)
      .join(', ');
    const job = bot.instructions ? ` — ${bot.instructions.split('\n')[0]!.slice(0, 120)}` : '';
    return `- ${bot.name} (${bot.id}${tags ? `; ${tags}` : ''})${job}`;
  });
  const groupLines = groups.map((group) => {
    const members = group.members
      .map((id) => bots.find((b) => b.id === id)?.name ?? id)
      .join(', ');
    return `- ${group.name} (${group.id}) · members: ${members || '(none)'}`;
  });
  const text = [
    'Bots:',
    ...(lines.length ? lines : ['(none)']),
    '',
    groups.length ? 'Groups:' : 'Groups: none',
    ...groupLines,
  ].join('\n');
  return toolOk(text, {
    bots: bots.map((b) => ({ id: b.id, name: b.name, role: b.role, isMain: b.isMain })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, members: g.members })),
  });
}

async function createBot(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const caller = await ctx.store.getBot(ctx.currentBotId);
  if (!caller?.isMain) {
    return toolErr('只有主机器人（Main / Chief）可以创建 bot。请让 Chief 代为创建。');
  }
  const name = String(args.name ?? '').trim();
  const role = String(args.role ?? '').trim();
  const instructions = String(args.instructions ?? '').trim();
  if (!name || !role || !instructions) {
    return toolErr('name、role、instructions 都是必填项。');
  }
  let model: BotConfig['model'] | undefined;
  try {
    model = parseModelRef(typeof args.model === 'string' ? args.model : undefined) ?? null;
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }
  const bot = await ctx.store.createBot({
    name,
    role,
    instructions,
    model,
    isMain: false,
  });
  return toolOk(`已创建 bot ${bot.name}（${bot.id}）。它会出现在侧栏。`, {
    botId: bot.id,
    name: bot.name,
    role: bot.role,
  });
}

async function listSessions(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  let bot: BotConfig;
  try {
    bot = await resolveBot(ctx.store, typeof args.botId === 'string' ? args.botId : undefined, ctx.currentBotId);
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }
  const sessions = await ctx.pool.listBotSessions(bot);
  if (sessions.length === 0) {
    return toolOk(`${bot.name} 还没有任何会话。`, { botId: bot.id, sessions: [] });
  }
  return toolOk(
    `${bot.name} 的会话：\n${sessions.map(summarizeSession).join('\n')}`,
    { botId: bot.id, sessions }
  );
}

async function createSession(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const hopBlock = assertHop(ctx);
  if (hopBlock) return hopBlock;

  let bot: BotConfig;
  try {
    bot = await resolveBot(ctx.store, typeof args.botId === 'string' ? args.botId : undefined, ctx.currentBotId);
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }

  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : undefined;
  const initialPrompt = typeof args.initialPrompt === 'string' ? args.initialPrompt.trim() : '';
  const created = await ctx.pool.createBotSession(bot, name);
  const hop = nextHop(ctx);

  if (initialPrompt) {
    await ctx.pool.startChat(bot, initialPrompt, created.id, { hop });
    return toolOk(
      `已创建会话 ${created.name || created.id}（sessionId=${created.id}，bot=${bot.name}）。` +
        `initialPrompt 已在后台运行；用 pibot_get_session_result 取回结果，不要自己用 bash 去查天气或网页。`,
      {
        sessionId: created.id,
        botId: bot.id,
        name: created.name,
        running: true,
        hop,
      }
    );
  }

  return toolOk(`已创建会话 ${created.name || created.id}（sessionId=${created.id}，bot=${bot.name}）。`, {
    sessionId: created.id,
    botId: bot.id,
    name: created.name,
    running: false,
    hop,
  });
}

async function sendToSession(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  return deliverToSession(args, ctx, { awaitDefault: false, label: 'pibot_send_to_session' });
}

async function askBot(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const mapped = {
    ...args,
    botId: args.botId ?? args.bot ?? args.to,
  };
  return deliverToSession(mapped, ctx, { awaitDefault: true, label: 'pibot_ask_bot' });
}

async function deliverToSession(
  args: Record<string, unknown>,
  ctx: PibotToolContext,
  options: { awaitDefault: boolean; label: string }
): Promise<PibotToolResult> {
  const hopBlock = assertHop(ctx);
  if (hopBlock) return hopBlock;

  const message = String(args.message ?? args.prompt ?? '').trim();
  if (!message) {
    return toolErr('message 不能为空。');
  }

  let bot: BotConfig;
  try {
    bot = await resolveBot(
      ctx.store,
      typeof args.botId === 'string' ? args.botId : undefined,
      ctx.currentBotId
    );
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }

  const sessionId =
    typeof args.sessionId === 'string' && args.sessionId.trim()
      ? args.sessionId.trim()
      : (await ctx.pool.ensureActiveSessionId(bot));

  const awaitReply =
    typeof args.awaitReply === 'boolean' ? args.awaitReply : options.awaitDefault;
  const timeoutMs =
    typeof args.timeoutMs === 'number' && args.timeoutMs > 0
      ? args.timeoutMs
      : DEFAULT_ASK_TIMEOUT_MS;
  const hop = nextHop(ctx);

  const accepted = await ctx.pool.startChat(bot, message, sessionId, { hop });

  if (!awaitReply) {
    return toolOk(
      `已把消息发给 ${bot.name} 的会话 ${accepted.sessionId}。回复稍后可用 pibot_get_session_result 读取。`,
      { sessionId: accepted.sessionId, botId: bot.id, runId: accepted.runId, hop, waiting: false }
    );
  }

  try {
    const text = await ctx.pool.waitForAssistant(bot, accepted.sessionId, timeoutMs);
    return toolOk(text || `(${bot.name} 没有返回文本)`, {
      sessionId: accepted.sessionId,
      botId: bot.id,
      hop,
      waiting: false,
      reply: text,
    });
  } catch (error) {
    return toolErr(
      `等待 ${bot.name} 回复超时或失败：${error instanceof Error ? error.message : String(error)}。可用 pibot_get_session_result 再取。`,
      { sessionId: accepted.sessionId, botId: bot.id, hop }
    );
  }
}

async function getSessionResult(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const sessionId = String(args.sessionId ?? '').trim();
  if (!sessionId) {
    return toolErr('sessionId 必填。');
  }
  let bot: BotConfig;
  try {
    bot = await resolveBot(
      ctx.store,
      typeof args.botId === 'string' ? args.botId : undefined,
      ctx.currentBotId
    );
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }

  const waitMs =
    typeof args.waitMs === 'number' && args.waitMs > 0
      ? args.waitMs
      : typeof args.timeoutMs === 'number' && args.timeoutMs > 0
        ? args.timeoutMs
        : 0;

  try {
    const text = waitMs
      ? await ctx.pool.waitForAssistant(bot, sessionId, waitMs)
      : await ctx.pool.getLatestAssistantText(bot, sessionId);
    if (!text) {
      return toolOk(`会话 ${sessionId} 还没有助手回复（可能仍在运行）。`, {
        sessionId,
        botId: bot.id,
        status: 'pending',
        text: '',
      });
    }
    return toolOk(text, { sessionId, botId: bot.id, status: 'ready', text });
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error), {
      sessionId,
      botId: bot.id,
      status: 'error',
    });
  }
}

async function createGroup(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const caller = await ctx.store.getBot(ctx.currentBotId);
  if (!caller?.isMain) {
    return toolErr('只有主机器人可以创建群聊。');
  }
  const name = String(args.name ?? '').trim();
  if (!name) {
    return toolErr('name 必填。');
  }
  const memberRefs = nameList(args.members);
  const memberIds: string[] = [];
  for (const ref of memberRefs) {
    try {
      const bot = await resolveBot(ctx.store, ref);
      if (!memberIds.includes(bot.id)) memberIds.push(bot.id);
    } catch (error) {
      return toolErr(error instanceof Error ? error.message : String(error));
    }
  }
  if (!memberIds.includes(ctx.currentBotId)) {
    memberIds.unshift(ctx.currentBotId);
  }
  const request: GroupCreateRequest = {
    name,
    members: memberIds,
    admin: [ctx.currentBotId],
    notice: typeof args.notice === 'string' ? args.notice : undefined,
    mode: args.mode === 'admin' || args.mode === 'everyone' ? args.mode : 'everyone',
  };
  try {
    const group = await ctx.groups.createGroup(request);
    return toolOk(`已创建群聊「${group.name}」（${group.id}），成员 ${group.members.length} 人。`, {
      groupId: group.id,
      name: group.name,
      members: group.members,
    });
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }
}

async function postGroup(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const hopBlock = assertHop(ctx);
  if (hopBlock) return hopBlock;
  const ref = String(args.group ?? args.groupId ?? args.name ?? '').trim();
  const message = String(args.message ?? '').trim();
  if (!ref) return toolErr('group / groupId 必填。');
  if (!message) return toolErr('message 不能为空。');

  const groups = ctx.groups.listGroups();
  const group =
    groups.find((g) => g.id === ref) ??
    groups.find((g) => g.name === ref) ??
    groups.find((g) => g.name.toLowerCase() === ref.toLowerCase());
  if (!group) {
    return toolErr(`找不到群聊「${ref}」。${groups.map((g) => g.name).join(', ') || '当前没有群聊。'}`);
  }
  try {
    const result = await ctx.groups.postToGroup({
      groupId: group.id,
      message,
      from: ctx.currentBotId,
    });
    const replies = result.replies
      .map((r) => `- ${r.botId}: ${r.passed ? '[PASS]' : r.message.slice(0, 200)}`)
      .join('\n');
    return toolOk(`已发到群聊「${group.name}」。\n${replies || '(暂无回复)'}`, {
      groupId: group.id,
      replies: result.replies,
    });
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }
}

async function scheduleTask(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  const message = String(args.message ?? args.prompt ?? '').trim();
  const cron = String(args.cron ?? args.time ?? '').trim();
  if (!message) return toolErr('message 必填。');
  if (!cron) return toolErr('cron（或 time）必填，例如 "0 9 * * *"。');

  let bot: BotConfig;
  try {
    bot = await resolveBot(
      ctx.store,
      typeof args.botId === 'string' ? args.botId : undefined,
      ctx.currentBotId
    );
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }

  const timezone =
    typeof args.timezone === 'string' && args.timezone.trim()
      ? args.timezone.trim()
      : ctx.getTimezone();
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : undefined;

  try {
    const schedule = await ctx.scheduler.create({
      botId: bot.id,
      name,
      prompt: message,
      timeType: 'cron',
      time: cron,
      timezone,
    });
    return toolOk(
      `已创建定时任务 ${schedule.id}${name ? `「${name}」` : ''}（tz=${schedule.timezone}，下次 ${schedule.nextRun ?? '计算中'}）。`,
      {
        id: schedule.id,
        name: schedule.name,
        message: schedule.prompt,
        timezone: schedule.timezone,
        nextRun: schedule.nextRun,
      }
    );
  } catch (error) {
    return toolErr(error instanceof Error ? error.message : String(error));
  }
}

async function listTasks(args: Record<string, unknown>, ctx: PibotToolContext): Promise<PibotToolResult> {
  let botId: string | undefined;
  if (typeof args.botId === 'string' && args.botId.trim()) {
    try {
      botId = (await resolveBot(ctx.store, args.botId)).id;
    } catch (error) {
      return toolErr(error instanceof Error ? error.message : String(error));
    }
  }
  const tasks = await ctx.scheduler.list(botId);
  if (tasks.length === 0) {
    return toolOk('没有定时任务。', { tasks: [] });
  }
  const lines = tasks.map((s) => {
    const label = s.name || s.prompt.slice(0, 40);
    return `- ${s.id} 「${label}」 tz=${s.timezone} ${s.enabled ? 'on' : 'off'} next=${s.nextRun ?? 'n/a'}`;
  });
  return toolOk(lines.join('\n'), {
    tasks: tasks.map((s) => ({
      id: s.id,
      name: s.name,
      message: s.prompt,
      timezone: s.timezone,
      enabled: s.enabled,
      nextRun: s.nextRun,
    })),
  });
}

async function secretList(ctx: PibotToolContext): Promise<PibotToolResult> {
  const secrets = await ctx.secrets.list(ctx.currentBotId);
  const names = secrets.map((s) => s.name);
  if (names.length === 0) {
    return toolOk('没有已授权的密钥（只返回名称，不含值）。', { names: [] });
  }
  return toolOk(`密钥名称：${names.join(', ')}`, { names });
}
