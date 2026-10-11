/**
 * Session pool: Manages concurrent bot sessions via pi SDK
 * 
 * Each bot gets its own AgentSession. Sessions are lazily created,
 * idle-evicted, and limited by max concurrency.
 */

import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createAgentSession,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { BotConfig } from '#shared/index.js';
import type {
  SessionPoolConfig,
  SessionPoolStats,
  SessionInfo,
  SessionEvent,
  DeliveryOptions,
  BotSession,
} from './types.js';

const MAX_HOPS = 6; // Prevent infinite message loops

export class SessionPool extends EventEmitter {
  private sessions = new Map<string, BotSession>();
  private config: SessionPoolConfig;
  private idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(config: SessionPoolConfig) {
    super();
    this.config = config;
  }

  /**
   * Get or create a session for a bot
   */
  async getSession(bot: BotConfig): Promise<BotSession> {
    // Return existing session if available
    const existing = this.sessions.get(bot.id);
    if (existing) {
      this.touchSession(bot.id);
      return existing;
    }

    // Check if we're at capacity
    if (this.sessions.size >= this.config.maxSessions) {
      // Try to evict an idle session
      const evicted = this.evictOldestIdle();
      if (!evicted) {
        throw new Error(
          `Session pool at capacity (${this.config.maxSessions}), no idle sessions to evict`
        );
      }
    }

    // Create new session
    return await this.createSession(bot);
  }

  /**
   * Create a new session for a bot
   */
  private async createSession(bot: BotConfig): Promise<BotSession> {
    const sessionId = `${bot.id}-${randomUUID().slice(0, 8)}`;
    const sessionPath = join(this.config.sessionDir, 'bots', bot.id);

    // Create session manager for this bot
    const sessionManager = await SessionManager.create(sessionPath);

    // Create runtime and session
    const result = await createAgentSession({
      sessionManager,
      model: `${bot.model.provider}/${bot.model.modelId}` as never,
    });

    const session = result.session;

    // Set session name
    await session.setSessionName(bot.name);

    const now = Date.now();
    const botSession: BotSession = {
      botId: bot.id,
      result,
      session,
      info: {
        botId: bot.id,
        sessionId,
        created: now,
        lastActive: now,
        status: 'idle',
        messageCount: 0,
      },
    };

    // Subscribe to session events
    this.subscribeToSession(botSession);

    this.sessions.set(bot.id, botSession);
    this.startIdleTimer(bot.id);

    this.emit('session_created', { type: 'session_created', botId: bot.id } as SessionEvent);

    return botSession;
  }

  /**
   * Subscribe to session events and forward them
   */
  private subscribeToSession(botSession: BotSession) {
    const { session, botId } = botSession;

    session.subscribe((event) => {
      // Update status based on event
      switch (event.type) {
        case 'agent_start':
          botSession.info.status = 'active';
          this.emit('status_change', {
            type: 'status_change',
            botId,
            status: 'active',
          } as SessionEvent);
          break;

        case 'agent_end':
          botSession.info.status = 'settling';
          this.emit('status_change', {
            type: 'status_change',
            botId,
            status: 'settling',
          } as SessionEvent);
          break;

        case 'turn_end':
          botSession.info.status = 'idle';
          this.emit('status_change', {
            type: 'status_change',
            botId,
            status: 'idle',
          } as SessionEvent);
          this.touchSession(botId);
          break;

        case 'message_start':
          if ('id' in event.message) {
            this.emit('message_start', {
              type: 'message_start',
              botId,
              messageId: String(event.message.id),
            } as SessionEvent);
          }
          break;

        case 'message_update':
          if (event.assistantMessageEvent?.type === 'text_delta') {
            if ('id' in event.message) {
              this.emit('message_update', {
                type: 'message_update',
                botId,
                messageId: String(event.message.id),
                delta: event.assistantMessageEvent.delta,
              } as SessionEvent);
            }
          }
          break;

        case 'message_end':
          botSession.info.messageCount++;
          if ('id' in event.message && 'text' in event.message) {
            this.emit('message_end', {
              type: 'message_end',
              botId,
              messageId: String(event.message.id),
              text: event.message.text || '',
            } as SessionEvent);
          }
          break;

        case 'tool_execution_start':
          this.emit('tool_call', {
            type: 'tool_call',
            botId,
            tool: event.toolName,
            args: event.args,
          } as SessionEvent);
          break;

        default:
          // Ignore other events
          break;
      }
    });
  }

  /**
   * Send a message to a bot session
   */
  async sendMessage(
    _botId: string,
    message: string,
    bot: BotConfig,
    options: DeliveryOptions = {}
  ): Promise<void> {
    const hop = (options.hop ?? 0) + 1;
    if (hop > MAX_HOPS) {
      throw new Error(`Message hop limit exceeded (${MAX_HOPS})`);
    }

    const botSession = await this.getSession(bot);

    // Format message with sender info if from another bot
    let formattedMessage = message;
    if (options.from && options.from !== 'user') {
      formattedMessage = `[Message from ${options.from}]\n${message}`;
    }

    // Prompt the session
    await botSession.session.prompt(formattedMessage);
  }

  /**
   * Get session info for a bot
   */
  getSessionInfo(botId: string): SessionInfo | null {
    const session = this.sessions.get(botId);
    return session ? session.info : null;
  }

  /**
   * List all active sessions
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }

  /**
   * Get pool statistics
   */
  getStats(): SessionPoolStats {
    const sessions = Array.from(this.sessions.values());
    return {
      active: sessions.filter((s) => s.info.status === 'active' || s.info.status === 'settling')
        .length,
      idle: sessions.filter((s) => s.info.status === 'idle').length,
      total: sessions.length,
      maxSessions: this.config.maxSessions,
    };
  }

  /**
   * Destroy a specific session
   */
  async destroySession(botId: string): Promise<void> {
    const session = this.sessions.get(botId);
    if (!session) return;

    this.clearIdleTimer(botId);

    try {
      await session.session.dispose();
    } catch (error) {
      console.error(`Failed to dispose session ${botId}:`, error);
    }

    this.sessions.delete(botId);
    this.emit('session_destroyed', { type: 'session_destroyed', botId } as SessionEvent);
  }

  /**
   * Destroy all sessions
   */
  async destroy(): Promise<void> {
    const botIds = Array.from(this.sessions.keys());
    await Promise.all(botIds.map((id) => this.destroySession(id)));
  }

  /**
   * Touch a session to reset idle timer
   */
  private touchSession(botId: string) {
    const session = this.sessions.get(botId);
    if (session) {
      session.info.lastActive = Date.now();
      this.restartIdleTimer(botId);
    }
  }

  /**
   * Start idle timer for a session
   */
  private startIdleTimer(botId: string) {
    this.clearIdleTimer(botId);

    const timer = setTimeout(() => {
      this.emit('session_idle', { type: 'session_idle', botId } as SessionEvent);
      void this.destroySession(botId);
    }, this.config.idleTimeoutMs);

    this.idleTimers.set(botId, timer);
  }

  /**
   * Restart idle timer for a session
   */
  private restartIdleTimer(botId: string) {
    this.clearIdleTimer(botId);
    this.startIdleTimer(botId);
  }

  /**
   * Clear idle timer for a session
   */
  private clearIdleTimer(botId: string) {
    const timer = this.idleTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(botId);
    }
  }

  /**
   * Evict the oldest idle session
   */
  private evictOldestIdle(): boolean {
    const idleSessions = Array.from(this.sessions.values())
      .filter((s) => s.info.status === 'idle')
      .sort((a, b) => a.info.lastActive - b.info.lastActive);

    if (idleSessions.length === 0) {
      return false;
    }

    const oldest = idleSessions[0];
    if (oldest) {
      void this.destroySession(oldest.botId);
    }
    return true;
  }
}
