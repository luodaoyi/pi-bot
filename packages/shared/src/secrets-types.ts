/**
 * Secrets types for pi-bot
 */

export type SecretScope = 'all' | string[]; // 'all' or array of bot IDs

export interface SecretConfig {
  name: string;
  value: string;
  purpose: string;
  scope: SecretScope;
  requestedBy: string; // bot ID
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastUsedAt?: string; // ISO 8601
}

export interface SecretInfo {
  name: string;
  purpose: string;
  scope: SecretScope;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  // value is never returned
}

export interface SecretRequestData {
  name: string;
  purpose: string;
  botId: string;
}

export interface SecretApprovalRequest {
  name: string;
  value: string;
  scope: SecretScope;
}

export interface SecretListResponse {
  secrets: SecretInfo[];
}
