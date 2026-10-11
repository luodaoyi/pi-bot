/**
 * Bot configuration and state types
 */

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Canonical bot/session model reference. null = follow pi default. */
export interface ModelRef {
  provider: string;
  id: string;
}

export type BotModel = ModelRef | null;

export interface BotConfig {
  id: string;
  name: string;
  role: string;
  instructions: string;
  /** null = follow pi settings default / first available model */
  model: BotModel;
  thinking?: ThinkingLevel | null;
  look?: {
    avatar?: string;
    color?: string;
  };
  isMain: boolean;
  created: string;
  segments: string[]; // Session IDs for different conversation parts
  activeSessionId?: string | null;
}

export interface BotCreateRequest {
  name: string;
  role: string;
  instructions: string;
  model?: BotModel | { provider: string; modelId?: string; id?: string } | string | null;
  thinking?: ThinkingLevel | null;
  look?: {
    avatar?: string;
    color?: string;
  };
  isMain?: boolean;
}

export interface BotUpdateRequest {
  name?: string;
  role?: string;
  instructions?: string;
  model?: BotModel | { provider: string; modelId?: string; id?: string } | string | null;
  thinking?: ThinkingLevel | null;
  look?: {
    avatar?: string;
    color?: string;
  };
  activeSessionId?: string | null;
}

export interface GroupConfig {
  id: string;
  name: string;
  notice?: string;
  members: string[]; // Bot IDs
  admin: string[]; // Bot IDs with admin privileges
  mode: 'everyone' | 'admin'; // Who can reply
  created: string;
}

export interface GroupCreateRequest {
  name: string;
  notice?: string;
  members: string[];
  admin?: string[];
  mode?: 'everyone' | 'admin';
}

export interface Schedule {
  id: string;
  targetKind: 'bot' | 'group';
  targetId: string;
  message: string;
  kind: 'once' | 'daily' | 'weekly' | 'interval';
  spec: string; // cron expression or interval
  tz: string;
  nextAt: string;
  lastAt?: string;
  enabled: boolean;
}

export interface Secret {
  name: string;
  purpose: string;
  scope: 'all' | string[]; // 'all' or list of bot IDs
  requestedBy: string; // Bot ID
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface SecretCreateRequest {
  name: string;
  value: string;
  purpose: string;
  scope?: 'all' | string[];
}
