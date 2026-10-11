import type { Bot, Message, Schedule } from "@pi-bot/protocol";
import { SessionPool } from "./pool.js";
import { SecretsStore } from "./secrets.js";
import { UsageStore } from "./usage.js";
import { Scheduler, createSchedule as makeSchedule, validateCron } from "./schedules.js";
import type { State } from "./store.js";
import { saveState } from "./store.js";
import { randomUUID } from "node:crypto";

export interface DaemonOptions {
  state: State;
  statePath: string;
  secretsPath: string;
  usagePath: string;
}

export class Daemon {
  private pool: SessionPool;
  private secrets: SecretsStore;
  private usage: UsageStore;
  private scheduler: Scheduler;
  private state: State;
  private statePath: string;
  private messageQueue = new Map<string, Message[]>();

  constructor(options: DaemonOptions) {
    this.state = options.state;
    this.statePath = options.statePath;
    
    this.pool = new SessionPool({ maxSessions: 10 });
    this.secrets = new SecretsStore(options.secretsPath);
    this.usage = new UsageStore(options.usagePath);
    
    this.scheduler = new Scheduler(async (schedule) => {
      await this.executeSchedule(schedule);
    });
  }

  async init(): Promise<void> {
    await this.secrets.load();
    
    for (const schedule of this.state.schedules) {
      if (schedule.enabled) {
        this.scheduler.add(schedule);
      }
    }

    await this.scheduler.checkMissedRuns(this.state.schedules);
  }

  async shutdown(): Promise<void> {
    this.scheduler.shutdown();
    await this.pool.shutdown();
    this.usage.close();
  }

  async createSession(bot: Bot): Promise<any> {
    return this.pool.getOrCreate(bot, async () => {
      const { createAgentSession } = await import("@earendil-works/pi-coding-agent");

      const result = await createAgentSession({
        cwd: process.cwd(),
        model: bot.model as any,
      });

      const session = result.session;

      // TODO: Apply extensions after session creation
      // For now, return the session directly
      // Extensions will need to be loaded using the session's extension API

      return session;
    });
  }

  async sendMessage(botId: string, content: string): Promise<any> {
    const bot = this.state.bots[botId];
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    const session = await this.createSession(bot);
    
    this.pool.setActive(botId, true);
    
    try {
      // Prepend bot instructions to the message
      const fullContent = `${bot.instructions}\n\n${content}`;
      
      const startTime = Date.now();
      const result = await session.sendMessage(fullContent);
      const latency = Date.now() - startTime;

      // Extract usage from result if available
      const usage = (result as any).usage;
      if (usage) {
        this.usage.record({
          botId: bot.id,
          botName: bot.name,
          model: bot.model,
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          cachedTokens: usage.cache_read_tokens,
          latencyMs: latency,
        });
      }

      return result;
    } finally {
      this.pool.setActive(botId, false);
    }
  }

  async routeMessage(message: Message): Promise<void> {
    const targetBot = this.state.bots[message.to];
    if (!targetBot) {
      console.error(`Target bot ${message.to} not found`);
      return;
    }

    const queue = this.messageQueue.get(message.to) ?? [];
    queue.push(message);
    this.messageQueue.set(message.to, queue);

    const content = `[Message from ${message.fromName}]\n${message.content}`;
    
    try {
      const result = await this.sendMessage(message.to, content);
      
      if (message.expectReply && result.content) {
        const reply: Message = {
          id: randomUUID(),
          from: message.to,
          fromName: targetBot.name,
          to: message.from,
          toName: message.fromName,
          content: result.content,
          timestamp: Date.now(),
          hops: message.hops + 1,
          replyTo: message.id,
        };
        
        await this.routeMessage(reply);
      }
    } catch (error) {
      console.error(`Failed to deliver message to ${targetBot.name}:`, error);
    }
  }

  async executeSchedule(schedule: Schedule): Promise<void> {
    const bot = this.state.bots[schedule.botId];
    if (!bot) {
      console.error(`Bot ${schedule.botId} for schedule ${schedule.name} not found`);
      return;
    }

    console.log(`Executing schedule: ${schedule.name} for bot ${bot.name}`);
    
    try {
      await this.sendMessage(schedule.botId, schedule.prompt);
      
      const idx = this.state.schedules.findIndex((s) => s.id === schedule.id);
      if (idx >= 0) {
        this.state.schedules[idx]!.lastRun = Date.now();
        await this.persist();
      }
    } catch (error) {
      console.error(`Schedule ${schedule.name} failed:`, error);
    }
  }

  createSchedule(spec: {
    botId: string;
    name: string;
    cron: string;
    prompt: string;
    timezone?: string;
    enabled?: boolean;
  }): Schedule {
    if (!validateCron(spec.cron)) {
      throw new Error(`Invalid cron expression: ${spec.cron}`);
    }

    const schedule = makeSchedule(spec);
    this.state.schedules.push(schedule);
    
    if (schedule.enabled) {
      this.scheduler.add(schedule);
    }

    void this.persist();
    
    return schedule;
  }

  updateSchedule(id: string, updates: Partial<Schedule>): Schedule | undefined {
    const idx = this.state.schedules.findIndex((s) => s.id === id);
    if (idx < 0) return undefined;

    const schedule = this.state.schedules[idx];
    if (!schedule) return undefined;
    
    Object.assign(schedule, updates);

    if (updates.cron && !validateCron(updates.cron)) {
      throw new Error(`Invalid cron expression: ${updates.cron}`);
    }

    if (schedule.enabled) {
      this.scheduler.update(schedule);
    } else {
      this.scheduler.remove(id);
    }

    void this.persist();
    
    return schedule;
  }

  deleteSchedule(id: string): boolean {
    const idx = this.state.schedules.findIndex((s) => s.id === id);
    if (idx < 0) return false;

    this.state.schedules.splice(idx, 1);
    this.scheduler.remove(id);
    
    void this.persist();
    
    return true;
  }

  private async persist(): Promise<void> {
    try {
      await saveState(this.statePath, this.state);
    } catch (error) {
      console.error("Failed to persist state:", error);
    }
  }

  getState(): State {
    return this.state;
  }

  getSecrets(): SecretsStore {
    return this.secrets;
  }

  getUsage(): UsageStore {
    return this.usage;
  }

  getPool(): SessionPool {
    return this.pool;
  }
}
