/**
 * Scheduler types for pi-bot
 */

export type ScheduleTimeType = 'at' | 'daily' | 'weekly' | 'every' | 'cron';

export type MissedRunPolicy = 'run-once' | 'skip';

export interface ScheduleConfig {
  id: string;
  botId: string;
  /** 展示名，与 prompt/message 分开存 */
  name?: string;
  prompt: string;
  timeType: ScheduleTimeType;
  time: string; // ISO 8601 for 'at', cron expression, or interval like '1h', '30m'
  timezone: string; // IANA timezone, e.g. 'America/New_York'
  missedPolicy: MissedRunPolicy;
  enabled: boolean;
  created: string; // ISO 8601
  lastRun?: string; // ISO 8601
  nextRun?: string; // ISO 8601
}

export interface ScheduleCreateRequest {
  botId: string;
  name?: string;
  prompt: string;
  timeType: ScheduleTimeType;
  time: string;
  timezone?: string;
  missedPolicy?: MissedRunPolicy;
}

export interface ScheduleUpdateRequest {
  enabled?: boolean;
  name?: string;
  prompt?: string;
  time?: string;
  timezone?: string;
  missedPolicy?: MissedRunPolicy;
}

export interface ScheduleListResponse {
  schedules: ScheduleConfig[];
}
