/**
 * 注入到每个 bot 会话的 pi-bot 团队说明
 */

import type { BotConfig } from '#shared/index.js';
import type { PibotToolContext } from './types.js';

export function buildPibotSystemPrompt(self: BotConfig, others: BotConfig[]): string {
  const roster = others
    .map((bot) => {
      const tag = bot.isMain ? 'Main' : bot.role;
      const you = bot.id === self.id ? ' ← you' : '';
      return `- ${bot.name} (${bot.id}, ${tag})${you}`;
    })
    .join('\n');

  const identity = [
    '# You are running inside pi-bot',
    `You are ${self.name} (${self.id})${self.role ? `, role: ${self.role}` : ''}${self.isMain ? ', Main bot' : ''}.`,
    self.instructions ? self.instructions : '',
    '',
    '## Team',
    roster || '- (only you)',
    '',
    '## When to use pibot_* tools',
    '- You cannot manage bots/sessions/groups/tasks by guessing or by using bash. Use the pibot_* tools.',
    '- User says "创建一个会话 / 开个子代理 / 让别人去研究 X 再回来告诉我" → call `pibot_create_session` with `name` + `initialPrompt` (the research brief). It returns `sessionId` immediately and runs in the background. Then call `pibot_get_session_result` with that `sessionId` (optionally `waitMs`) and answer the user yourself.',
    '- Ask another bot something and wait → `pibot_ask_bot`. Fire-and-forget → `pibot_send_to_session`.',
    '- List teammates / groups → `pibot_list_bots`. Create a specialist (Main only) → `pibot_create_bot`.',
    '- Groups: `pibot_create_group`, `pibot_post_group`. Tasks: `pibot_schedule_task` (cron, timezone defaults to the user\'s settings timezone, not UTC), `pibot_list_tasks`. Secrets: `pibot_secret_list` (names only).',
    '- Hop limit: do not bounce messages in a loop. If a hop-limit error is returned, stop and report to the user.',
    '- Never curl the weather or scrape the web yourself when the user asked you to create a session/sub-agent to research it.',
  ];

  return identity.filter((line, i) => line !== '' || identity[i - 1] !== '').join('\n');
}

export async function buildPibotSystemPromptFromCtx(ctx: PibotToolContext): Promise<string> {
  const bots = await ctx.store.listBots();
  const self = bots.find((b) => b.id === ctx.currentBotId);
  if (!self) {
    return '# You are running inside pi-bot\nUse pibot_* tools to manage bots, sessions, groups, and tasks.';
  }
  return buildPibotSystemPrompt(self, bots);
}
