import type { Bot } from "@pi-bot/protocol";

export interface SessionPoolOptions {
  maxSessions?: number;
  idleTimeout?: number;
}

export interface BotSession {
  botId: string;
  session: any;
  lastUsed: number;
  active: boolean;
}

export class SessionPool {
  private sessions = new Map<string, BotSession>();
  private readonly maxSessions: number;
  private readonly idleTimeout: number;

  constructor(options: SessionPoolOptions = {}) {
    this.maxSessions = options.maxSessions ?? 10;
    this.idleTimeout = options.idleTimeout ?? 30 * 60 * 1000;
    
    this.startCleanupTimer();
  }

  async getOrCreate(bot: Bot, createFn: () => Promise<any>): Promise<any> {
    const existing = this.sessions.get(bot.id);
    
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.session;
    }

    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldest();
    }

    const session = await createFn();
    
    this.sessions.set(bot.id, {
      botId: bot.id,
      session,
      lastUsed: Date.now(),
      active: false,
    });

    return session;
  }

  get(botId: string): any | undefined {
    const session = this.sessions.get(botId);
    if (session) {
      session.lastUsed = Date.now();
      return session.session;
    }
    return undefined;
  }

  async remove(botId: string): Promise<void> {
    const session = this.sessions.get(botId);
    if (!session) return;

    try {
      if (session.session?.shutdown) {
        await session.session.shutdown();
      }
    } catch (error) {
      console.error(`Failed to shutdown session for bot ${botId}:`, error);
    }

    this.sessions.delete(botId);
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.sessions.values()).map(async (bs) => {
      try {
        if (bs.session?.shutdown) {
          await bs.session.shutdown();
        }
      } catch (error) {
        console.error(`Failed to shutdown session for bot ${bs.botId}:`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);
    this.sessions.clear();
  }

  private async evictOldest(): Promise<void> {
    let oldest: BotSession | undefined;
    
    for (const session of this.sessions.values()) {
      if (session.active) continue;
      if (!oldest || session.lastUsed < oldest.lastUsed) {
        oldest = session;
      }
    }

    if (oldest) {
      await this.remove(oldest.botId);
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const toRemove: string[] = [];

      for (const [botId, session] of this.sessions) {
        if (!session.active && now - session.lastUsed > this.idleTimeout) {
          toRemove.push(botId);
        }
      }

      for (const botId of toRemove) {
        void this.remove(botId);
      }
    }, 60000);
  }

  setActive(botId: string, active: boolean): void {
    const session = this.sessions.get(botId);
    if (session) {
      session.active = active;
    }
  }

  getStats() {
    return {
      total: this.sessions.size,
      active: Array.from(this.sessions.values()).filter((s) => s.active).length,
      maxSessions: this.maxSessions,
    };
  }
}
