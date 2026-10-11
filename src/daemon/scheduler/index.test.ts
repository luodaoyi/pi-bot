import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScheduler } from './index.js';
import type { ScheduleConfig } from '#shared/index.js';

describe('Scheduler', () => {
  let tempDir: string;
  let triggered: ScheduleConfig[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pi-bot-scheduler-test-'));
    triggered = [];
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create and list schedules', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async (schedule) => {
        triggered.push(schedule);
      },
    });

    const schedule = await scheduler.create({
      botId: 'bot-123',
      prompt: 'Test task',
      timeType: 'daily',
      time: '09:00',
      timezone: 'UTC',
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.botId).toBe('bot-123');
    expect(schedule.enabled).toBe(true);

    const list = await scheduler.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(schedule.id);

    await scheduler.shutdown();
  });

  it('should filter schedules by botId', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    await scheduler.create({
      botId: 'bot-1',
      prompt: 'Task 1',
      timeType: 'daily',
      time: '09:00',
    });

    await scheduler.create({
      botId: 'bot-2',
      prompt: 'Task 2',
      timeType: 'daily',
      time: '10:00',
    });

    const bot1Tasks = await scheduler.list('bot-1');
    expect(bot1Tasks).toHaveLength(1);
    expect(bot1Tasks[0].botId).toBe('bot-1');

    await scheduler.shutdown();
  });

  it('should update schedule', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    const schedule = await scheduler.create({
      botId: 'bot-123',
      prompt: 'Original prompt',
      timeType: 'daily',
      time: '09:00',
    });

    const updated = await scheduler.update(schedule.id, {
      prompt: 'Updated prompt',
      enabled: false,
    });

    expect(updated.prompt).toBe('Updated prompt');
    expect(updated.enabled).toBe(false);

    await scheduler.shutdown();
  });

  it('should delete schedule', async () => {
    const scheduler = await createScheduler({
      storePath: join(tempDir, 'schedules.json'),
      onTrigger: async () => {},
    });

    const schedule = await scheduler.create({
      botId: 'bot-123',
      prompt: 'Test task',
      timeType: 'daily',
      time: '09:00',
    });

    await scheduler.delete(schedule.id);

    const list = await scheduler.list();
    expect(list).toHaveLength(0);

    await scheduler.shutdown();
  });

  it('should persist schedules across restarts', async () => {
    const storePath = join(tempDir, 'schedules.json');

    // First instance
    const scheduler1 = await createScheduler({
      storePath,
      onTrigger: async () => {},
    });

    await scheduler1.create({
      botId: 'bot-123',
      prompt: 'Persistent task',
      timeType: 'daily',
      time: '09:00',
    });

    await scheduler1.shutdown();

    // Second instance should load existing schedules
    const scheduler2 = await createScheduler({
      storePath,
      onTrigger: async () => {},
    });

    const list = await scheduler2.list();
    expect(list).toHaveLength(1);
    expect(list[0].prompt).toBe('Persistent task');

    await scheduler2.shutdown();
  });
});
