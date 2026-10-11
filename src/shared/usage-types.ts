/**
 * Usage tracking types for pi-bot
 */

export interface UsageRecord {
  id: string;
  botId: string;
  sessionId: string;
  provider: string;
  model: string;
  kind: 'turn' | 'memory' | 'steward' | 'summary' | 'other';
  timestamp: string; // ISO 8601
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  cost?: number; // USD cents
}

export interface UsageStatsDetailed {
  totalInputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalOutputTokens: number;
  totalCost: number; // USD cents
  callCount: number;
}

export interface UsageAggregation {
  botId?: string;
  model?: string;
  date?: string; // YYYY-MM-DD
  stats: UsageStatsDetailed;
}

export interface UsageQueryParams {
  botId?: string;
  model?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  kind?: string;
  limit?: number;
  offset?: number;
}

export interface UsageListResponse {
  records: UsageRecord[];
  total: number;
}

export interface UsageStatsResponse {
  aggregations: UsageAggregation[];
}
