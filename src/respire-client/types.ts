/**
 * Respire RPC protocol types
 * Based on respire-cli @ d9a4673
 */

export const PROTOCOL_V = 1;

// ============================================================================
// RPC Request/Response
// ============================================================================

export interface RpcRequest {
  v: number;
  id: string;
  method: string;
  args: string[];
  queue_wait_ms?: number;
}

export interface RpcResponse {
  v: number;
  id: string;
  ok: boolean;
  exit: number;
  bin: string;
  envelope?: ResultEnvelope;
  error?: string;
  code?: string;
  web_url?: string;
  pid?: number;
  data_dir?: string;
}

export interface ResultEnvelope {
  command: string;
  status: 'ok' | 'warn' | 'fail' | 'skip' | 'pending';
  summary?: Record<string, unknown>;
  items?: Array<{
    name: string;
    status: string;
    value?: unknown;
    action?: string;
  }>;
  actions?: unknown[];
  errors?: string[];
  details?: unknown;
  related?: unknown[];
}

// ============================================================================
// Health Check
// ============================================================================

export interface HealthResponse {
  server: string;
  bin: string;
  pid: number;
  v: number;
  url: string;
  exe: string;
  data_dir: string;
  recall_statistics?: unknown;
  retrieval_index?: unknown;
  inference?: unknown;
  rpc?: unknown;
}

// ============================================================================
// Memory API
// ============================================================================

export interface RecallOptions {
  mode?: 'fast' | 'quality';
  limit?: number;
  project?: string;
  titles?: boolean;
  noRelated?: boolean;
}

export interface RecallDetail {
  id: string;
  title: string;
  score: number;
  content?: string;
  superseded_by?: string;
  kind?: string;
  importance?: string;
  project?: string;
  updated_at?: string;
  created_at?: string;
}

export interface RecallResult {
  query: string;
  count: number;
  limit: number;
  project?: string;
  details: RecallDetail[];
  related?: string[];
}

export interface RememberOptions {
  title?: string;
  importance?: 'important' | 'trivial';
  parent?: string;
  force?: boolean;
  mergeIds?: string[];
  supersedes?: string;
  seeAlso?: string[];
  project?: string;
  type?: string;
}

export interface RememberResult {
  id?: string;
  candidates?: Array<{
    id: string;
    content: string;
  }>;
  message: string;
}

export interface MemoryEntry {
  id: string;
  kind?: string;
  title?: string;
  content: string;
  created_at: string;
  updated_at?: string;
  project?: string;
  importance?: string;
  parent_id?: string;
}

export interface AgentConfig {
  memory_off?: boolean;
  readonly?: boolean;
  workspace_mode?: string;
  [key: string]: unknown;
}

// ============================================================================
// Client Options
// ============================================================================

export interface RespireClientOptions {
  port?: number;
  timeout?: number;
  autostart?: boolean;
}
