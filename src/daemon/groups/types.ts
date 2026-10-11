/**
 * Group chat types
 */

export interface GroupConfig {
  id: string;
  name: string;
  notice?: string;
  members: string[]; // Bot IDs
  admin: string[]; // Bot IDs with admin privileges
  mode: 'everyone' | 'admin'; // Who can speak
  created: string;
  log: GroupLogEntry[]; // Recent messages (max 60)
  seq: number; // Message sequence number
  seen: Record<string, number>; // Last seen seq per member
  sessions: Record<string, string>; // Hidden session ID per member
}

export interface GroupLogEntry {
  seq: number;
  from: string; // 'user' or bot ID
  message: string;
  timestamp: number;
  mention?: string; // Next speaker if @mentioned
}

export interface GroupCreateRequest {
  name: string;
  notice?: string;
  members: string[]; // Bot IDs
  admin?: string[];
  mode?: 'everyone' | 'admin';
}

export interface GroupUpdateRequest {
  name?: string;
  notice?: string;
  members?: string[];
  admin?: string[];
  mode?: 'everyone' | 'admin';
}

export interface PostToGroupRequest {
  groupId: string;
  message: string;
  from?: string; // Bot ID, defaults to 'user'
}

export interface GroupRoundResult {
  groupId: string;
  replies: Array<{
    botId: string;
    message: string;
    passed: boolean;
  }>;
  nextSpeaker?: string;
}
