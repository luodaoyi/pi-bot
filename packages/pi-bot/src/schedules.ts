import { CronExpressionParser } from "cron-parser";
import type { Schedule } from "@pi-bot/protocol";
import { randomUUID } from "node:crypto";

export interface ScheduleJob {
  schedule: Schedule;
  nextRun: number;
  timer?: NodeJS.Timeout;
}

export type ScheduleHandler = (schedule: Schedule) => Promise<void>;

export class Scheduler {
  private jobs = new Map<string, ScheduleJob>();
  private handler: ScheduleHandler;

  constructor(handler: ScheduleHandler, _missedRunFile?: string) {
    this.handler = handler;
  }

  add(schedule: Schedule): void {
    if (this.jobs.has(schedule.id)) {
      this.remove(schedule.id);
    }

    const nextRun = this.calculateNextRun(schedule);
    const delay = Math.max(0, nextRun - Date.now());

    const timer = setTimeout(() => {
      void this.execute(schedule);
    }, delay);

    this.jobs.set(schedule.id, {
      schedule,
      nextRun,
      timer,
    });
  }

  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.timer) {
      clearTimeout(job.timer);
    }

    this.jobs.delete(id);
    return true;
  }

  update(schedule: Schedule): void {
    this.add(schedule);
  }

  get(id: string): Schedule | undefined {
    return this.jobs.get(id)?.schedule;
  }

  list(): Schedule[] {
    return Array.from(this.jobs.values())
      .map((j) => j.schedule)
      .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  }

  shutdown(): void {
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearTimeout(job.timer);
      }
    }
    this.jobs.clear();
  }

  private async execute(schedule: Schedule): Promise<void> {
    try {
      await this.handler(schedule);
    } catch (error) {
      console.error(`Schedule ${schedule.id} (${schedule.name}) failed:`, error);
    }

    if (schedule.enabled) {
      this.add(schedule);
    } else {
      this.remove(schedule.id);
    }
  }

  private calculateNextRun(schedule: Schedule): number {
    try {
      const interval = CronExpressionParser.parse(schedule.cron, {
        currentDate: new Date(),
        tz: schedule.timezone ?? "UTC",
      });
      return interval.next().getTime();
    } catch (error) {
      console.error(`Invalid cron expression for schedule ${schedule.id}:`, error);
      return Date.now() + 60000;
    }
  }

  getNextRun(id: string): number | undefined {
    return this.jobs.get(id)?.nextRun;
  }

  async checkMissedRuns(schedules: Schedule[]): Promise<void> {
    const now = Date.now();
    const hourAgo = now - 3600000;

    for (const schedule of schedules) {
      if (!schedule.enabled || !schedule.lastRun) continue;

      const nextExpected = this.calculateNextRun({
        ...schedule,
        cron: schedule.cron,
      });

      if (nextExpected < now && schedule.lastRun < hourAgo) {
        console.log(`Running missed schedule: ${schedule.name} (${schedule.id})`);
        await this.execute(schedule);
      }
    }
  }
}

export function createSchedule(spec: {
  botId: string;
  name: string;
  cron: string;
  prompt: string;
  timezone?: string;
  enabled?: boolean;
}): Schedule {
  return {
    id: randomUUID(),
    botId: spec.botId,
    name: spec.name,
    cron: spec.cron,
    prompt: spec.prompt,
    timezone: spec.timezone ?? "UTC",
    enabled: spec.enabled ?? true,
    created: Date.now(),
  };
}

export function validateCron(cron: string): boolean {
  try {
    CronExpressionParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}
