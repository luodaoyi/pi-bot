/**
 * Group chat manager
 * 
 * Implements DS-Bot style group chat:
 * - One-speaker-at-a-time turn-taking
 * - Each member has a hidden session per group
 * - Incremental context: members see messages since last turn
 * - @mention to address specific member
 * - [PASS] to skip turn silently
 * - Admin mode: only admins can speak
 * - Log limited to 60 entries
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Store } from '../store/index.js';
import type { SessionPool } from '../sessions/index.js';
import type {
  GroupConfig,
  GroupLogEntry,
  GroupCreateRequest,
  GroupUpdateRequest,
  PostToGroupRequest,
  GroupRoundResult,
} from './types.js';

const MAX_LOG_SIZE = 60;
const MAX_NEW_MESSAGES = 24;
const PASS_PATTERN = /^\[PASS\]$/i;
const MENTION_PATTERN = /@(\w+)/;

export class GroupManager extends EventEmitter {
  private store: Store;
  private sessionPool: SessionPool;
  private groups = new Map<string, GroupConfig>();
  private activeRounds = new Set<string>(); // Groups currently running a round

  constructor(store: Store, sessionPool: SessionPool) {
    super();
    this.store = store;
    this.sessionPool = sessionPool;
  }

  /**
   * Create a new group
   */
  async createGroup(request: GroupCreateRequest): Promise<GroupConfig> {
    const groupId = `grp-${randomUUID().slice(0, 8)}`;

    // Validate members exist
    for (const memberId of request.members) {
      const bot = await this.store.getBot(memberId);
      if (!bot) {
        throw new Error(`Bot not found: ${memberId}`);
      }
    }

    // Validate admins are members
    const admin = request.admin ?? request.members.slice(0, 1);
    for (const adminId of admin) {
      if (!request.members.includes(adminId)) {
        throw new Error(`Admin ${adminId} must be a member`);
      }
    }

    const group: GroupConfig = {
      id: groupId,
      name: request.name,
      notice: request.notice,
      members: request.members,
      admin,
      mode: request.mode ?? 'everyone',
      created: new Date().toISOString(),
      log: [],
      seq: 0,
      seen: {},
      sessions: {},
    };

    // Initialize seen cursors
    for (const memberId of request.members) {
      group.seen[memberId] = 0;
    }

    this.groups.set(groupId, group);
    await this.saveGroups();

    this.emit('group_created', { type: 'group_created', group });

    return group;
  }

  /**
   * Update group settings
   */
  async updateGroup(groupId: string, request: GroupUpdateRequest): Promise<GroupConfig> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    if (request.name) group.name = request.name;
    if (request.notice !== undefined) group.notice = request.notice;
    if (request.mode) group.mode = request.mode;

    if (request.members) {
      // Validate new members
      for (const memberId of request.members) {
        const bot = await this.store.getBot(memberId);
        if (!bot) {
          throw new Error(`Bot not found: ${memberId}`);
        }
      }

      // Update members and seen cursors
      const oldMembers = new Set(group.members);
      const newMembers = new Set(request.members);

      // Add new members
      for (const memberId of newMembers) {
        if (!oldMembers.has(memberId)) {
          group.seen[memberId] = group.seq; // Start from current position
        }
      }

      // Remove old members
      for (const memberId of oldMembers) {
        if (!newMembers.has(memberId)) {
          delete group.seen[memberId];
          delete group.sessions[memberId];
        }
      }

      group.members = request.members;
    }

    if (request.admin) {
      // Validate admins are members
      for (const adminId of request.admin) {
        if (!group.members.includes(adminId)) {
          throw new Error(`Admin ${adminId} must be a member`);
        }
      }
      group.admin = request.admin;
    }

    await this.saveGroups();
    this.emit('group_updated', { type: 'group_updated', group });

    return group;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    // TODO: Clean up hidden sessions for members

    this.groups.delete(groupId);
    await this.saveGroups();

    this.emit('group_deleted', { type: 'group_deleted', groupId });
  }

  /**
   * Post a message to group and run a round
   */
  async postToGroup(request: PostToGroupRequest): Promise<GroupRoundResult> {
    const { groupId, message, from = 'user' } = request;

    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    // Prevent concurrent rounds
    if (this.activeRounds.has(groupId)) {
      throw new Error(`Group ${groupId} is already running a round`);
    }

    this.activeRounds.add(groupId);

    try {
      // Add message to log
      this.appendToLog(group, from, message);

      // Run a round
      const result = await this.runRound(group);

      return result;
    } finally {
      this.activeRounds.delete(groupId);
    }
  }

  /**
   * Run a round of group chat
   */
  private async runRound(group: GroupConfig): Promise<GroupRoundResult> {
    const replies: Array<{ botId: string; message: string; passed: boolean }> = [];

    // Determine speaking order
    const speakers = this.determineSpeakers(group);

    for (const _botId of speakers) {
      const bot = await this.store.getBot(_botId);
      if (!bot) continue;

      // Get incremental context for this member
      const context = this.getIncrementalContext(group, _botId);

      // Prompt member's hidden session
      await this.getOrCreateGroupSession(group, _botId);
      const prompt = this.formatGroupPrompt(group, _botId, context, speakers);

      try {
        // Send message to member
        await this.sessionPool.sendMessage(_botId, prompt, bot);

        // Wait for reply
        const reply = await this.waitForReply(_botId);

        // Check if passed
        const passed = PASS_PATTERN.test(reply.trim());

        if (!passed) {
          // Add reply to log
          const mention = this.extractMention(reply);
          this.appendToLog(group, _botId, reply, mention);

          replies.push({ botId: _botId, message: reply, passed: false });

          // If mentioned someone, continue to them
          if (mention && group.members.includes(mention)) {
            continue;
          }
        } else {
          replies.push({ botId: _botId, message: '[PASS]', passed: true });
        }

        // Update seen cursor
        group.seen[_botId] = group.seq;
      } catch (error) {
        console.error(`Error getting reply from ${_botId}:`, error);
      }
    }

    await this.saveGroups();

    return {
      groupId: group.id,
      replies,
      nextSpeaker: replies.length > 0 ? replies[replies.length - 1]?.botId : undefined,
    };
  }

  /**
   * Determine speaking order for a round
   */
  private determineSpeakers(group: GroupConfig): string[] {
    if (group.mode === 'admin') {
      // Only admins speak
      return group.admin;
    }

    // Everyone mode: admins first, then others in order
    const admins = group.admin;
    const others = group.members.filter((m) => !admins.includes(m));
    return [...admins, ...others];
  }

  /**
   * Get incremental context for a member
   */
  private getIncrementalContext(group: GroupConfig, botId: string): GroupLogEntry[] {
    const lastSeen = group.seen[botId] ?? 0;
    const newMessages = group.log.filter((entry) => entry.seq > lastSeen);

    // Limit to MAX_NEW_MESSAGES
    return newMessages.slice(-MAX_NEW_MESSAGES);
  }

  /**
   * Format prompt for group member
   */
  private formatGroupPrompt(
    group: GroupConfig,
    _botId: string,
    context: GroupLogEntry[],
    speakers: string[]
  ): string {
    const lines: string[] = [];

    lines.push(`[Group chat: ${group.name}]`);
    if (group.notice) {
      lines.push(`Notice: ${group.notice}`);
    }

    // Show context
    if (context.length > 0) {
      lines.push('');
      lines.push('Recent messages:');
      for (const entry of context) {
        const sender = entry.from === 'user' ? 'User' : entry.from;
        lines.push(`${sender}: ${entry.message}`);
      }
    }

    // Show speaking order
    lines.push('');
    lines.push(`Speaking order: ${speakers.join(' → ')}`);
    lines.push(`It's your turn to speak. Reply with [PASS] to skip.`);
    lines.push(`Use @mention to address a specific member.`);

    return lines.join('\n');
  }

  /**
   * Wait for bot to reply
   */
  private async waitForReply(botId: string, timeoutMs = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for reply from ${botId}`));
      }, timeoutMs);

      const handler = (event: { type: string; botId: string; text?: string }) => {
        if (event.type === 'message_end' && event.botId === botId) {
          cleanup();
          resolve(event.text ?? '');
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.sessionPool.off('message_end', handler);
      };

      this.sessionPool.on('message_end', handler);
    });
  }

  /**
   * Get or create hidden session for group member
   */
  private async getOrCreateGroupSession(group: GroupConfig, _botId: string): Promise<string> {
    const _sessionId = group.sessions[_botId];

    if (!_sessionId) {
      const newSessionId = `${group.id}-${_botId}-${randomUUID().slice(0, 8)}`;
      group.sessions[_botId] = newSessionId;
      await this.saveGroups();
      return newSessionId;
    }

    return _sessionId;
  }

  /**
   * Extract @mention from message
   */
  private extractMention(message: string): string | undefined {
    const match = message.match(MENTION_PATTERN);
    return match?.[1];
  }

  /**
   * Append entry to group log
   */
  private appendToLog(
    group: GroupConfig,
    from: string,
    message: string,
    mention?: string
  ): void {
    group.seq++;

    const entry: GroupLogEntry = {
      seq: group.seq,
      from,
      message,
      timestamp: Date.now(),
      mention,
    };

    group.log.push(entry);

    // Trim log to max size
    if (group.log.length > MAX_LOG_SIZE) {
      group.log = group.log.slice(-MAX_LOG_SIZE);
    }
  }

  /**
   * Get group by ID
   */
  getGroup(groupId: string): GroupConfig | null {
    return this.groups.get(groupId) ?? null;
  }

  /**
   * List all groups
   */
  listGroups(): GroupConfig[] {
    return Array.from(this.groups.values());
  }

  /**
   * Save groups to store
   */
  private async saveGroups(): Promise<void> {
    // TODO: Integrate with store
    // For now, groups are in-memory
  }
}
