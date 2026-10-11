/**
 * Respire Runtime RPC Protocol Types
 * Based on respire-cli/cli/src/rpc.rs
 */

export const PROTOCOL_V = 1;

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
  bin?: string;
  envelope?: ResultEnvelope;
  error?: string;
  code?: string;
  web_url?: string;
  pid?: number;
  data_dir?: string;
}

export interface ResultEnvelope {
  command: string;
  status: "ok" | "warn" | "fail" | "skip" | "pending";
  summary?: Record<string, any>;
  items?: EnvelopeItem[];
  actions?: any[];
  errors?: string[];
  details?: any;
  related?: any[];
}

export interface EnvelopeItem {
  name: string;
  status: "ok" | "warn" | "fail" | "skip";
  value?: any;
  action?: string;
}

export interface Health {
  server: string;
  bin: string;
  pid: number;
  v: number;
  url: string;
  exe: string;
  data_dir: string;
  recall_statistics?: any;
  retrieval_index?: any;
  inference?: any;
  rpc?: any;
}

export interface AgentConfig {
  memory_off?: boolean;
  readonly?: boolean;
  workspace_mode?: string;
  [key: string]: any;
}

export interface RecallResult {
  query: string;
  count: number;
  limit: number;
  project?: string;
  recall_mode?: string;
  embedding_model?: string;
  related?: string[];
  routing?: any;
  index_pending?: boolean;
  items?: Array<{
    id: string;
    title: string;
    score: number;
    superseded_by?: string;
  }>;
}

export interface MemoryEntry {
  id: string;
  kind?: string;
  tags?: string[];
  title?: string;
  content: string;
  user?: string;
  computer?: string;
  project?: string;
  created_at?: string;
  updated_at?: string;
  emotion?: string;
  parent_id?: string;
  importance?: "important" | "trivial";
  device?: string;
  modified_by?: string;
  supersedes?: string[];
  superseded_by?: string;
  see_also?: string[];
}

export interface RememberOptions {
  title: string;
  importance?: "important" | "trivial";
  parent?: string;
  type?: string;
  project?: string;
  tags?: string[];
  force?: boolean;
  merge_ids?: string[];
  supersedes?: string[];
  see_also?: string[];
}

export interface RememberResult {
  status: "ok" | "skip";
  id?: string;
  candidates?: MemoryEntry[];
  message?: string;
}

export class RespireError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly response?: RpcResponse,
  ) {
    super(message);
    this.name = "RespireError";
  }
}
