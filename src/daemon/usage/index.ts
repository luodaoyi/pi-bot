/**
 * Usage tracking: Record and aggregate token usage and costs
 * 
 * Now uses Node.js built-in node:sqlite (available since Node 22.5)
 */

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type {
  UsageRecord,
  UsageStatsDetailed,
  UsageAggregation,
  UsageQueryParams,
} from '#shared/index.js';

export interface UsageOptions {
  dbPath: string;
}

export class UsageTracker {
  private db: DatabaseSync | null = null;
  private dbPath: string;
  private initialized = false;

  constructor(options: UsageOptions) {
    this.dbPath = options.dbPath;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    const { dirname } = await import('node:path');
    const { mkdir } = await import('node:fs/promises');
    const dir = dirname(this.dbPath);
    await mkdir(dir, { recursive: true });

    // Open database
    this.db = new DatabaseSync(this.dbPath);

    // Enable WAL mode for better concurrency
    this.db.exec('PRAGMA journal_mode = WAL');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        kind TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        cache_read_tokens INTEGER NOT NULL,
        cache_write_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost REAL
      );

      CREATE INDEX IF NOT EXISTS idx_calls_bot_id ON calls(bot_id);
      CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(timestamp);
      CREATE INDEX IF NOT EXISTS idx_calls_model ON calls(model);
      CREATE INDEX IF NOT EXISTS idx_calls_kind ON calls(kind);
      CREATE INDEX IF NOT EXISTS idx_calls_bot_timestamp ON calls(bot_id, timestamp);
    `);

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  /**
   * Record a usage event
   */
  async record(
    botId: string,
    sessionId: string,
    provider: string,
    model: string,
    kind: 'turn' | 'memory' | 'steward' | 'summary' | 'other',
    inputTokens: number,
    cacheReadTokens: number,
    cacheWriteTokens: number,
    outputTokens: number,
    cost?: number
  ): Promise<UsageRecord> {
    if (!this.db) throw new Error('UsageTracker not initialized');

    const id = `use-${randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();

    const record: UsageRecord = {
      id,
      botId,
      sessionId,
      provider,
      model,
      kind,
      timestamp,
      inputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      outputTokens,
      cost,
    };

    const stmt = this.db.prepare(`
      INSERT INTO calls (
        id, bot_id, session_id, provider, model, kind, timestamp,
        input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      botId,
      sessionId,
      provider,
      model,
      kind,
      timestamp,
      inputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      outputTokens,
      cost ?? null as any
    );

    return record;
  }

  /**
   * Query usage records
   */
  async query(params: UsageQueryParams): Promise<{ records: UsageRecord[]; total: number }> {
    if (!this.db) throw new Error('UsageTracker not initialized');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.botId) {
      conditions.push('bot_id = ?');
      values.push(params.botId);
    }

    if (params.model) {
      conditions.push('model = ?');
      values.push(params.model);
    }

    if (params.kind) {
      conditions.push('kind = ?');
      values.push(params.kind);
    }

    if (params.startDate) {
      conditions.push('timestamp >= ?');
      values.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push('timestamp <= ?');
      values.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM calls ${whereClause}`);
    const countRow = countStmt.get(...(values as any[])) as { count: number };
    const total = countRow.count;

    // Get records with pagination
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const stmt = this.db.prepare(`
      SELECT * FROM calls ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...(values as any[]), limit, offset) as Array<{
      id: string;
      bot_id: string;
      session_id: string;
      provider: string;
      model: string;
      kind: string;
      timestamp: string;
      input_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
      output_tokens: number;
      cost: number | null;
    }>;

    const records: UsageRecord[] = rows.map((row) => ({
      id: row.id,
      botId: row.bot_id,
      sessionId: row.session_id,
      provider: row.provider,
      model: row.model,
      kind: row.kind as UsageRecord['kind'],
      timestamp: row.timestamp,
      inputTokens: row.input_tokens,
      cacheReadTokens: row.cache_read_tokens,
      cacheWriteTokens: row.cache_write_tokens,
      outputTokens: row.output_tokens,
      cost: row.cost ?? undefined,
    }));

    return { records, total };
  }

  /**
   * Get aggregated statistics
   */
  async aggregate(
    groupBy: 'bot' | 'model' | 'day',
    params: UsageQueryParams = {}
  ): Promise<UsageAggregation[]> {
    if (!this.db) throw new Error('UsageTracker not initialized');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.botId) {
      conditions.push('bot_id = ?');
      values.push(params.botId);
    }

    if (params.model) {
      conditions.push('model = ?');
      values.push(params.model);
    }

    if (params.kind) {
      conditions.push('kind = ?');
      values.push(params.kind);
    }

    if (params.startDate) {
      conditions.push('timestamp >= ?');
      values.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push('timestamp <= ?');
      values.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let groupByClause: string;
    let selectClause: string;

    switch (groupBy) {
      case 'bot':
        selectClause = 'bot_id';
        groupByClause = 'bot_id';
        break;
      case 'model':
        selectClause = 'model';
        groupByClause = 'model';
        break;
      case 'day':
        selectClause = "strftime('%Y-%m-%d', timestamp) as day";
        groupByClause = "strftime('%Y-%m-%d', timestamp)";
        break;
    }

    const stmt = this.db.prepare(`
      SELECT
        ${selectClause},
        SUM(input_tokens) as total_input,
        SUM(cache_read_tokens) as total_cache_read,
        SUM(cache_write_tokens) as total_cache_write,
        SUM(output_tokens) as total_output,
        SUM(COALESCE(cost, 0)) as total_cost,
        COUNT(*) as call_count
      FROM calls ${whereClause}
      GROUP BY ${groupByClause}
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(...(values as any[])) as Array<{
      bot_id?: string;
      model?: string;
      day?: string;
      total_input: number;
      total_cache_read: number;
      total_cache_write: number;
      total_output: number;
      total_cost: number;
      call_count: number;
    }>;

    return rows.map((row) => {
      const agg: UsageAggregation = {
        stats: {
          totalInputTokens: row.total_input,
          totalCacheReadTokens: row.total_cache_read,
          totalCacheWriteTokens: row.total_cache_write,
          totalOutputTokens: row.total_output,
          totalCost: row.total_cost,
          callCount: row.call_count,
        },
      };

      if (row.bot_id) agg.botId = row.bot_id;
      if (row.model) agg.model = row.model;
      if (row.day) agg.date = row.day;

      return agg;
    });
  }

  /**
   * Get stats for a specific bot
   */
  async getBotStats(botId: string, days = 30): Promise<UsageStatsDetailed> {
    if (!this.db) throw new Error('UsageTracker not initialized');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stmt = this.db.prepare(`
      SELECT
        SUM(input_tokens) as total_input,
        SUM(cache_read_tokens) as total_cache_read,
        SUM(cache_write_tokens) as total_cache_write,
        SUM(output_tokens) as total_output,
        SUM(COALESCE(cost, 0)) as total_cost,
        COUNT(*) as call_count
      FROM calls
      WHERE bot_id = ? AND timestamp >= ?
    `);

    const row = stmt.get(botId, startDate.toISOString()) as {
      total_input: number | null;
      total_cache_read: number | null;
      total_cache_write: number | null;
      total_output: number | null;
      total_cost: number | null;
      call_count: number;
    };

    return {
      totalInputTokens: row.total_input ?? 0,
      totalCacheReadTokens: row.total_cache_read ?? 0,
      totalCacheWriteTokens: row.total_cache_write ?? 0,
      totalOutputTokens: row.total_output ?? 0,
      totalCost: row.total_cost ?? 0,
      callCount: row.call_count,
    };
  }

  /**
   * Clear old records
   */
  async clearOldRecords(daysToKeep = 90): Promise<number> {
    if (!this.db) throw new Error('UsageTracker not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.prepare('DELETE FROM calls WHERE timestamp < ?');
    const result = stmt.run(cutoffDate.toISOString());

    return Number(result.changes ?? 0);
  }
}

export async function createUsageTracker(options: UsageOptions): Promise<UsageTracker> {
  const tracker = new UsageTracker(options);
  await tracker.init();
  return tracker;
}
