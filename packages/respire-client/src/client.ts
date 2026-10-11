/**
 * Respire Runtime HTTP RPC Client
 * Based on respire-cli protocol @ d9a4673
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { RespireError } from './errors.js';
import type {
  RpcRequest,
  RpcResponse,
  HealthResponse,
  RecallOptions,
  RecallResult,
  RememberOptions,
  RememberResult,
  MemoryEntry,
  AgentConfig,
  RespireClientOptions,
  PROTOCOL_V,
} from './types.js';

const DEFAULT_PORT = 15169;
const DEFAULT_TIMEOUT = 120000; // 120 seconds

export class RespireClient {
  private readonly port: number;
  private readonly timeout: number;
  private readonly baseUrl: string;
  private readonly autostart: boolean;

  constructor(options: RespireClientOptions = {}) {
    this.port = options.port ?? (Number(process.env['RSRS_RPC_PORT']) || DEFAULT_PORT);
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.baseUrl = `http://127.0.0.1:${this.port}`;
    this.autostart = options.autostart ?? true;
  }

  // ============================================================================
  // Low-level RPC
  // ============================================================================

  private async http<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? this.timeout);

    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Do NOT include Origin header (Respire checks for empty/matching origin)
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw RespireError.transport(`HTTP ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof RespireError) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw RespireError.transport('Request timeout');
      }
      throw RespireError.transport(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<HealthResponse> {
    const h = await this.http<HealthResponse>('GET', '/api/health', undefined, 2000);

    if (h.server !== 'respire') {
      throw RespireError.protocolMismatch(`Not a Respire runtime: ${h.server}`);
    }

    if (h.v !== (1 as typeof PROTOCOL_V)) {
      throw RespireError.protocolMismatch(`Protocol version mismatch: ${h.v}`);
    }

    return h;
  }

  async call(
    method: string,
    args: string[] = [],
    options: {
      id?: string;
      queueWaitMs?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<RpcResponse> {
    const request: RpcRequest = {
      v: 1,
      id: options.id ?? randomUUID(),
      method,
      args,
    };

    if (options.queueWaitMs !== undefined) {
      request.queue_wait_ms = options.queueWaitMs;
    }

    const response = await this.http<RpcResponse>(
      'POST',
      '/api/rpc',
      request,
      options.timeoutMs
    );

    if (response.v !== 1 || response.code === 'protocol_version_mismatch') {
      throw RespireError.protocolMismatch(response.error ?? 'Protocol mismatch');
    }

    return response;
  }

  async exec(argv: string[], options?: { id?: string; queueWaitMs?: number }): Promise<RpcResponse> {
    const response = await this.call('cli.exec', ['--json', ...argv], options);

    if (!response.envelope) {
      throw new RespireError(
        response.error ?? 'Empty response',
        (response.code as never) ?? 'unknown',
        response
      );
    }

    return response;
  }

  async result(requestId: string): Promise<unknown> {
    const response = await this.call('runtime.result', [requestId]);
    return response.envelope?.summary;
  }

  // ============================================================================
  // Lifecycle & Health
  // ============================================================================

  async ensureUp(): Promise<HealthResponse> {
    try {
      return await this.health();
    } catch (error) {
      if (!this.autostart) {
        throw error;
      }

      // Try to start runtime by invoking CLI once
      const rsrsPath = process.env['PATH']?.split(':')
        .map((p) => `${p}/rsrs`)
        .find((p) => {
          try {
            return existsSync(p);
          } catch {
            return false;
          }
        });

      if (!rsrsPath && process.env['RSRS_CLIENT_ONLY'] !== '1') {
        // Trigger daemon start via CLI
        await new Promise<void>((resolve, reject) => {
          const child = spawn('rsrs', ['--json', 'status'], {
            stdio: 'ignore',
          });

          child.on('exit', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(RespireError.unavailable('Failed to start Respire runtime'));
            }
          });

          child.on('error', (err) => {
            reject(RespireError.unavailable(`Failed to start Respire: ${err.message}`));
          });
        });

        // Wait a bit for runtime to be ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return await this.health();
    }
  }

  // ============================================================================
  // Memory API (thin wrappers around cli.exec)
  // ============================================================================

  async recall(query: string, options: RecallOptions = {}): Promise<RecallResult> {
    const args = ['recall', query];

    if (options.mode) args.push('--mode', options.mode);
    if (options.limit) args.push('--limit', String(options.limit));
    if (options.project) args.push('--project', options.project);
    if (options.titles) args.push('--titles');
    if (options.noRelated) args.push('--no-related');

    const response = await this.exec(args);
    const envelope = response.envelope!;

    if (envelope.status === 'skip') {
      return {
        query,
        count: 0,
        limit: options.limit ?? 20,
        details: [],
      };
    }

    return {
      query,
      count: (envelope.summary?.['count'] as number) ?? 0,
      limit: (envelope.summary?.['limit'] as number) ?? 20,
      project: options.project,
      details: (envelope.details as RecallResult['details']) ?? [],
      related: envelope.summary?.['related'] as string[] | undefined,
    };
  }

  async show(id: string): Promise<MemoryEntry | null> {
    const response = await this.exec(['show', id]);

    if (response.envelope?.status === 'skip') {
      return null;
    }

    return (response.envelope?.details as { entry?: MemoryEntry })?.entry ?? null;
  }

  async remember(content: string, options: RememberOptions = {}): Promise<RememberResult> {
    const args = ['remember', content];

    if (options.title) args.push('--title', options.title);
    if (options.importance) args.push('--importance', options.importance);
    if (options.parent) args.push('--parent', options.parent);
    if (options.force) args.push('--force');
    if (options.mergeIds) args.push('--merge-ids', options.mergeIds.join(','));
    if (options.supersedes) args.push('--supersedes', options.supersedes);
    if (options.seeAlso) args.push('--see-also', options.seeAlso.join(','));
    if (options.project) args.push('--project', options.project);
    if (options.type) args.push('--type', options.type);

    const response = await this.exec(args);
    const envelope = response.envelope!;

    return {
      id: (envelope.summary?.['id'] as string) ?? undefined,
      candidates: (envelope.details as { candidates?: unknown[] })?.candidates as never,
      message: (envelope.summary?.['message'] as string) ?? 'Stored',
    };
  }

  async forget(id: string): Promise<boolean> {
    const response = await this.exec(['forget', id]);
    return response.envelope?.status === 'ok';
  }

  async diary(limit = 10): Promise<MemoryEntry[]> {
    const response = await this.exec(['diary', '--limit', String(limit)]);
    return ((response.envelope?.details as { entries?: MemoryEntry[] })?.entries ?? []);
  }

  async list(options: { limit?: number; since?: string } = {}): Promise<MemoryEntry[]> {
    const args = ['list'];
    if (options.limit) args.push('--limit', String(options.limit));
    if (options.since) args.push('--since', options.since);

    const response = await this.exec(args);
    return ((response.envelope?.details as { entries?: MemoryEntry[] })?.entries ?? []);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  async prompt(): Promise<string> {
    const response = await this.exec(['prompt']);
    return (response.envelope?.summary?.['instructions'] as string) ?? '';
  }

  async agentConfig(): Promise<AgentConfig> {
    const response = await this.exec(['agent-config']);
    return (response.envelope?.summary as AgentConfig) ?? {};
  }

  async status(): Promise<Record<string, unknown>> {
    const response = await this.exec(['status']);
    return (response.envelope?.summary as Record<string, unknown>) ?? {};
  }
}
