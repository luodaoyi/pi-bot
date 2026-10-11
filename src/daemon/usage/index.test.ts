import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Check if node:sqlite is available (requires Node >= 22.5)
let sqliteAvailable = false;
try {
  await import('node:sqlite');
  sqliteAvailable = true;
} catch {
  console.warn('node:sqlite not available, skipping UsageTracker tests');
}

describe.skipIf(!sqliteAvailable)('UsageTracker', () => {
  let tempDir: string;
  let createUsageTracker: any;

  beforeEach(async () => {
    if (!createUsageTracker) {
      const mod = await import('./index.js');
      createUsageTracker = mod.createUsageTracker;
    }
    tempDir = await mkdtemp(join(tmpdir(), 'pi-bot-usage-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should record and query usage', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    const record = await usage.record(
      'bot-123',
      'session-456',
      'deepseek',
      'deepseek-chat',
      'turn',
      1000,
      500,
      200,
      800,
      0.05
    );

    expect(record.id).toBeDefined();
    expect(record.botId).toBe('bot-123');
    expect(record.inputTokens).toBe(1000);

    const { records } = await usage.query({});
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(record.id);

    await usage.shutdown();
  });

  it('should filter by bot ID', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    await usage.record('bot-1', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 100, 0, 0, 50);
    await usage.record('bot-2', 'session-2', 'deepseek', 'deepseek-chat', 'turn', 200, 0, 0, 100);

    const { records } = await usage.query({ botId: 'bot-1' });
    expect(records).toHaveLength(1);
    expect(records[0].botId).toBe('bot-1');

    await usage.shutdown();
  });

  it('should filter by date range', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await usage.record('bot-1', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 100, 0, 0, 50);

    const { records: inRange } = await usage.query({
      startDate: yesterday.toISOString(),
      endDate: tomorrow.toISOString(),
    });
    expect(inRange).toHaveLength(1);

    const { records: outRange } = await usage.query({
      startDate: tomorrow.toISOString(),
    });
    expect(outRange).toHaveLength(0);

    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { records: dateOnly } = await usage.query({
      startDate: weekAgo,
      endDate: today,
    });
    expect(dateOnly).toHaveLength(1);
    const aggs = await usage.aggregate('bot', { startDate: weekAgo, endDate: today });
    expect(aggs[0]?.stats.totalInputTokens).toBeGreaterThan(0);

    await usage.shutdown();
  });

  it('should aggregate by bot', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    await usage.record('bot-1', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 1000, 100, 50, 500, 0.05);
    await usage.record('bot-1', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 2000, 200, 100, 1000, 0.10);
    await usage.record('bot-2', 'session-2', 'deepseek', 'deepseek-chat', 'turn', 500, 50, 25, 250, 0.03);

    const aggs = await usage.aggregate('bot');
    expect(aggs).toHaveLength(2);

    const bot1Agg = aggs.find((a) => a.botId === 'bot-1');
    expect(bot1Agg?.stats.totalInputTokens).toBe(3000);
    expect(bot1Agg?.stats.totalOutputTokens).toBe(1500);
    expect(bot1Agg?.stats.callCount).toBe(2);
    expect(bot1Agg?.stats.totalCost).toBeCloseTo(0.15);

    await usage.shutdown();
  });

  it('should aggregate by model', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    await usage.record('bot-1', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 1000, 0, 0, 500);
    await usage.record('bot-2', 'session-2', 'deepseek', 'deepseek-reasoner', 'turn', 2000, 0, 0, 1000);

    const aggs = await usage.aggregate('model');
    expect(aggs).toHaveLength(2);

    const chatAgg = aggs.find((a) => a.model === 'deepseek-chat');
    expect(chatAgg?.stats.totalInputTokens).toBe(1000);

    await usage.shutdown();
  });

  it('should get bot statistics', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    await usage.record('bot-123', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 1000, 100, 50, 500, 0.05);
    await usage.record('bot-123', 'session-2', 'deepseek', 'deepseek-chat', 'memory', 200, 50, 25, 100, 0.01);

    const stats = await usage.getBotStats('bot-123', 30);
    expect(stats.totalInputTokens).toBe(1200);
    expect(stats.totalCacheReadTokens).toBe(150);
    expect(stats.totalOutputTokens).toBe(600);
    expect(stats.callCount).toBe(2);
    expect(stats.totalCost).toBeCloseTo(0.06);

    await usage.shutdown();
  });

  it('should clear old records', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    // Record some usage
    await usage.record('bot-1', 'session-1', 'deepseek', 'deepseek-chat', 'turn', 100, 0, 0, 50);

    // Verify record exists
    const before = await usage.query({});
    expect(before.records).toHaveLength(1);

    // Clear records older than -1 days (i.e. older than tomorrow, should clear all)
    const deleted = await usage.clearOldRecords(-1);
    expect(deleted).toBeGreaterThan(0);

    const { records } = await usage.query({});
    expect(records).toHaveLength(0);

    await usage.shutdown();
  });

  it('should support pagination', async () => {
    const usage = await createUsageTracker({
      dbPath: join(tempDir, 'usage.sqlite'),
    });

    // Create 5 records
    for (let i = 0; i < 5; i++) {
      await usage.record('bot-1', `session-${i}`, 'deepseek', 'deepseek-chat', 'turn', 100, 0, 0, 50);
    }

    // First page
    const page1 = await usage.query({ limit: 2, offset: 0 });
    expect(page1.records).toHaveLength(2);
    expect(page1.total).toBe(5);

    // Second page
    const page2 = await usage.query({ limit: 2, offset: 2 });
    expect(page2.records).toHaveLength(2);
    expect(page2.total).toBe(5);

    // Last page
    const page3 = await usage.query({ limit: 2, offset: 4 });
    expect(page3.records).toHaveLength(1);

    await usage.shutdown();
  });
});
