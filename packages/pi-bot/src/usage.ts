import Database from "better-sqlite3";
import type { UsageRecord } from "@pi-bot/protocol";

export class UsageStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        bot_name TEXT,
        message_id TEXT,
        timestamp INTEGER NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        cached_tokens INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_usage_bot_id ON usage(bot_id);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_model ON usage(model);
    `);
  }

  record(usage: {
    botId: string;
    botName?: string;
    messageId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd?: number;
    cachedTokens?: number;
    latencyMs?: number;
    metadata?: any;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO usage (
        bot_id, bot_name, message_id, timestamp, model,
        input_tokens, output_tokens, total_tokens, cost_usd,
        cached_tokens, latency_ms, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      usage.botId,
      usage.botName ?? null,
      usage.messageId ?? null,
      Date.now(),
      usage.model,
      usage.inputTokens,
      usage.outputTokens,
      usage.totalTokens,
      usage.costUsd ?? 0,
      usage.cachedTokens ?? 0,
      usage.latencyMs ?? 0,
      usage.metadata ? JSON.stringify(usage.metadata) : null,
    );
  }

  query(options: {
    botId?: string;
    model?: string;
    since?: number;
    until?: number;
    limit?: number;
  }): UsageRecord[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.botId) {
      conditions.push("bot_id = ?");
      params.push(options.botId);
    }

    if (options.model) {
      conditions.push("model = ?");
      params.push(options.model);
    }

    if (options.since) {
      conditions.push("timestamp >= ?");
      params.push(options.since);
    }

    if (options.until) {
      conditions.push("timestamp <= ?");
      params.push(options.until);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit ? `LIMIT ${options.limit}` : "";

    const stmt = this.db.prepare(`
      SELECT 
        id, bot_id as botId, bot_name as botName, message_id as messageId,
        timestamp, model, input_tokens as inputTokens, 
        output_tokens as outputTokens, total_tokens as totalTokens,
        cost_usd as costUsd, cached_tokens as cachedTokens,
        latency_ms as latencyMs, metadata
      FROM usage
      ${where}
      ORDER BY timestamp DESC
      ${limit}
    `);

    const rows = stmt.all(...params) as any[];
    
    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  getStats(options: {
    botId?: string;
    model?: string;
    since?: number;
    until?: number;
  }): {
    totalMessages: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    byModel: Record<string, { messages: number; tokens: number; cost: number }>;
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.botId) {
      conditions.push("bot_id = ?");
      params.push(options.botId);
    }

    if (options.model) {
      conditions.push("model = ?");
      params.push(options.model);
    }

    if (options.since) {
      conditions.push("timestamp >= ?");
      params.push(options.since);
    }

    if (options.until) {
      conditions.push("timestamp <= ?");
      params.push(options.until);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(total_tokens) as totalTokens,
        SUM(cost_usd) as costUsd,
        AVG(latency_ms) as avgLatency
      FROM usage
      ${where}
    `);

    const overall = stmt.get(...params) as any;

    const modelStmt = this.db.prepare(`
      SELECT 
        model,
        COUNT(*) as messages,
        SUM(total_tokens) as tokens,
        SUM(cost_usd) as cost
      FROM usage
      ${where}
      GROUP BY model
    `);

    const byModel: Record<string, { messages: number; tokens: number; cost: number }> = {};
    
    for (const row of modelStmt.all(...params) as any[]) {
      byModel[row.model] = {
        messages: row.messages,
        tokens: row.tokens,
        cost: row.cost,
      };
    }

    return {
      totalMessages: overall.count ?? 0,
      totalInputTokens: overall.inputTokens ?? 0,
      totalOutputTokens: overall.outputTokens ?? 0,
      totalTokens: overall.totalTokens ?? 0,
      totalCostUsd: overall.costUsd ?? 0,
      avgLatencyMs: overall.avgLatency ?? 0,
      byModel,
    };
  }

  close(): void {
    this.db.close();
  }
}
