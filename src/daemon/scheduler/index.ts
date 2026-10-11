/**
 * Scheduler: Persistent task scheduler with timezone awareness
 * 
 * Based on DS-Bot schedules.js but adapted for pi SDK
 */

import { readFile } from 'node:fs/promises';
import { atomicWriteJson } from '#shared/index.js';
import { randomUUID } from 'node:crypto';
import { Cron } from 'croner';
import type {
  ScheduleConfig,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
} from '#shared/index.js';

export interface SchedulerOptions {
  storePath: string;
  onTrigger: (schedule: ScheduleConfig) => Promise<void>;
}

interface ScheduleState {
  schedules: Record<string, ScheduleConfig>;
}

export class Scheduler {
  private schedules = new Map<string, ScheduleConfig>();
  private jobs = new Map<string, Cron>();
  private storePath: string;
  private onTrigger: (schedule: ScheduleConfig) => Promise<void>;
  private initialized = false;

  constructor(options: SchedulerOptions) {
    this.storePath = options.storePath;
    this.onTrigger = options.onTrigger;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Load schedules from file
    await this.load();

    // Start all enabled schedules
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        await this.startSchedule(schedule);
      }
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // Stop all running jobs
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
    this.initialized = false;
  }

  private async load(): Promise<void> {
    try {
      const content = await readFile(this.storePath, 'utf-8');
      const state: ScheduleState = JSON.parse(content);
      
      for (const schedule of Object.values(state.schedules)) {
        this.schedules.set(schedule.id, schedule);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist yet, will be created on first save
    }
  }

  private async save(): Promise<void> {
    const state: ScheduleState = {
      schedules: Object.fromEntries(this.schedules),
    };
    await atomicWriteJson(this.storePath, state);
  }

  async create(request: ScheduleCreateRequest): Promise<ScheduleConfig> {
    const id = `sch-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const schedule: ScheduleConfig = {
      id,
      botId: request.botId,
      prompt: request.prompt,
      timeType: request.timeType,
      time: request.time,
      timezone: request.timezone || 'UTC',
      missedPolicy: request.missedPolicy || 'run-once',
      enabled: true,
      created: now,
    };

    // Calculate next run time
    schedule.nextRun = this.calculateNextRun(schedule);

    this.schedules.set(id, schedule);
    await this.save();

    // Start the schedule immediately
    await this.startSchedule(schedule);

    return schedule;
  }

  async update(id: string, request: ScheduleUpdateRequest): Promise<ScheduleConfig> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    const wasEnabled = schedule.enabled;

    // Update fields
    if (request.enabled !== undefined) schedule.enabled = request.enabled;
    if (request.prompt !== undefined) schedule.prompt = request.prompt;
    if (request.time !== undefined) schedule.time = request.time;
    if (request.timezone !== undefined) schedule.timezone = request.timezone;
    if (request.missedPolicy !== undefined) schedule.missedPolicy = request.missedPolicy;

    // Recalculate next run if time changed
    if (request.time !== undefined || request.timezone !== undefined) {
      schedule.nextRun = this.calculateNextRun(schedule);
    }

    await this.save();

    // Restart job if parameters changed
    if (wasEnabled || schedule.enabled) {
      await this.stopSchedule(id);
      if (schedule.enabled) {
        await this.startSchedule(schedule);
      }
    }

    return schedule;
  }

  async delete(id: string): Promise<void> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    await this.stopSchedule(id);
    this.schedules.delete(id);
    await this.save();
  }

  async list(botId?: string): Promise<ScheduleConfig[]> {
    const schedules = Array.from(this.schedules.values());
    if (botId) {
      return schedules.filter((s) => s.botId === botId);
    }
    return schedules;
  }

  async get(id: string): Promise<ScheduleConfig | null> {
    return this.schedules.get(id) ?? null;
  }

  private async startSchedule(schedule: ScheduleConfig): Promise<void> {
    const existing = this.jobs.get(schedule.id);
    if (existing) {
      existing.stop();
    }

    const cronExpression = this.toCronExpression(schedule);
    if (!cronExpression) {
      console.warn(`Cannot start schedule ${schedule.id}: invalid time configuration`);
      return;
    }

    try {
      const job = new Cron(
        cronExpression,
        {
          timezone: schedule.timezone,
        },
        async () => {
          await this.execute(schedule);
        }
      );

      this.jobs.set(schedule.id, job);

      // Handle missed runs on startup
      if (schedule.nextRun && schedule.missedPolicy === 'run-once') {
        const lastExpected = new Date(schedule.nextRun);
        const now = new Date();
        
        if (lastExpected < now) {
          // Missed run, execute once
          console.log(`Running missed schedule: ${schedule.id}`);
          await this.execute(schedule);
        }
      }
    } catch (error) {
      console.error(`Failed to start schedule ${schedule.id}:`, error);
    }
  }

  private async stopSchedule(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }
  }

  private async execute(schedule: ScheduleConfig): Promise<void> {
    const now = new Date().toISOString();
    
    console.log(`Executing schedule ${schedule.id} for bot ${schedule.botId}`);

    try {
      await this.onTrigger(schedule);

      // Update last run time
      schedule.lastRun = now;
      schedule.nextRun = this.calculateNextRun(schedule);
      await this.save();
    } catch (error) {
      console.error(`Failed to execute schedule ${schedule.id}:`, error);
    }
  }

  private calculateNextRun(schedule: ScheduleConfig): string | undefined {
    const cronExpr = this.toCronExpression(schedule);
    if (!cronExpr) return undefined;

    try {
      const cron = new Cron(cronExpr, { timezone: schedule.timezone });
      const next = cron.nextRun();
      cron.stop();
      return next ? next.toISOString() : undefined;
    } catch {
      return undefined;
    }
  }

  private toCronExpression(schedule: ScheduleConfig): string | null {
    switch (schedule.timeType) {
      case 'cron':
        return schedule.time;

      case 'at': {
        // One-time: parse ISO 8601 datetime
        // We'll use a workaround: schedule far in future and handle one-time manually
        // For now, treat as unsupported in recurring context
        return null;
      }

      case 'daily': {
        // time is "HH:mm"
        const [hour, minute] = schedule.time.split(':').map(Number);
        return `${minute} ${hour} * * *`;
      }

      case 'weekly': {
        // time is "day HH:mm" where day is 0-6 (Sun-Sat)
        const parts = schedule.time.split(' ');
        if (parts.length !== 2) return null;
        const day = parseInt(parts[0]!);
        const [hour, minute] = parts[1]!.split(':').map(Number);
        return `${minute} ${hour} * * ${day}`;
      }

      case 'every': {
        // time is interval like "1h", "30m", "1d"
        const match = schedule.time.match(/^(\d+)(m|h|d)$/);
        if (!match) return null;

        const value = parseInt(match[1]!);
        const unit = match[2]!;

        switch (unit) {
          case 'm':
            return `*/${value} * * * *`;
          case 'h':
            return `0 */${value} * * *`;
          case 'd':
            return `0 0 */${value} * *`;
          default:
            return null;
        }
      }

      default:
        return null;
    }
  }
}

export async function createScheduler(options: SchedulerOptions): Promise<Scheduler> {
  const scheduler = new Scheduler(options);
  await scheduler.init();
  return scheduler;
}
