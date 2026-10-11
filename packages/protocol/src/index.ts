export interface Bot {
  id: string;
  name: string;
  role: string;
  instructions: string;
  model: string;
  color?: string;
  avatar?: string;
  main: boolean;
  created: number;
  sessions: string[];
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  turnOrder: string[];
  currentTurn: number;
  created: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  botId: string;
  botName: string;
  content: string;
  mentions: string[];
  timestamp: number;
}

export interface Message {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  content: string;
  timestamp: number;
  hops: number;
  expectReply?: boolean;
  replyTo?: string;
}

export interface Question {
  id: string;
  botId: string;
  question: string;
  options?: string[];
  answer?: string;
  status: "pending" | "answered" | "timeout";
  timestamp: number;
}

export interface Schedule {
  id: string;
  botId: string;
  name: string;
  cron: string;
  prompt: string;
  timezone: string;
  enabled: boolean;
  created: number;
  lastRun?: number;
}

export interface Secret {
  key: string;
  description?: string;
  created: number;
}

export interface UsageRecord {
  id?: number;
  botId: string;
  botName?: string;
  messageId?: string;
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  cachedTokens?: number;
  latencyMs?: number;
  metadata?: any;
}

export interface APIResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface StreamEvent {
  type: "message_start" | "message_update" | "message_end" | "agent_settled" | "error";
  data?: any;
}
