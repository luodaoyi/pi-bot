import type {
  RpcRequest,
  RpcResponse,
  ResultEnvelope,
  Health,
  AgentConfig,
  RecallResult,
  MemoryEntry,
  RememberOptions,
  RememberResult,
} from "./types.js";
import { randomUUID } from "node:crypto";

export class RespireClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: { port?: number; timeout?: number } = {}) {
    const port = options.port ?? Number.parseInt(process.env.RSRS_RPC_PORT ?? "15169");
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.timeout = options.timeout ?? 120000;
  }

  async health(): Promise<Health> {
    const response = await this.fetch("GET", "/api/health", undefined, 2000);
    const data = (await response.json()) as Health;
    
    if (data.server !== "respire" || data.v !== 1) {
      throw new Error(
        `Incompatible runtime: server=${data.server} v=${data.v}`,
      );
    }
    
    return data;
  }

  async call(
    method: string,
    args: string[] = [],
    options: { id?: string; queueWaitMs?: number; timeout?: number } = {},
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

    const response = await this.fetch(
      "POST",
      "/api/rpc",
      JSON.stringify(request),
      options.timeout ?? this.timeout,
    );

    const data = (await response.json()) as RpcResponse;

    if (data.v !== 1 || data.code === "protocol_version_mismatch") {
      throw new Error(
        data.error ?? "Protocol version mismatch",
      );
    }

    return data;
  }

  async exec(argv: string[], options?: { id?: string; queueWaitMs?: number }): Promise<ResultEnvelope> {
    const response = await this.call("cli.exec", ["--json", ...argv], options);
    
    if (!response.envelope) {
      throw new Error(
        response.error ?? "Empty envelope",
      );
    }

    return response.envelope;
  }

  async result(requestId: string): Promise<any> {
    const response = await this.call("runtime.result", [requestId]);
    return response.envelope?.summary;
  }

  async prompt(): Promise<string> {
    const envelope = await this.exec(["prompt"]);
    return envelope.summary?.instructions ?? "";
  }

  async agentConfig(): Promise<AgentConfig> {
    const envelope = await this.exec(["agent-config"]);
    return envelope.summary ?? {};
  }

  async recall(
    query: string,
    options: {
      limit?: number;
      titles?: boolean;
      project?: string;
      mode?: "fast" | "quality";
    } = {},
  ): Promise<RecallResult> {
    const args = ["recall", query];
    
    if (options.limit) args.push("--limit", options.limit.toString());
    if (options.titles) args.push("--titles");
    if (options.project) args.push("--project", options.project);
    if (options.mode) args.push("--mode", options.mode);

    const envelope = await this.exec(args);
    
    return {
      query,
      count: envelope.summary?.count ?? 0,
      limit: options.limit ?? 20,
      project: options.project,
      recall_mode: envelope.summary?.recall_mode,
      embedding_model: envelope.summary?.embedding_model,
      related: envelope.summary?.related,
      items: envelope.details,
    };
  }

  async show(id: string): Promise<MemoryEntry> {
    const envelope = await this.exec(["show", id]);
    const entry = envelope.details?.entry;
    
    if (!entry) {
      throw new Error(`Memory entry ${id} not found`);
    }
    
    return entry;
  }

  async remember(
    content: string,
    options: RememberOptions,
  ): Promise<RememberResult> {
    const args = ["remember", content, "--title", options.title];
    
    if (options.importance) args.push("--importance", options.importance);
    if (options.parent) args.push("--parent", options.parent);
    if (options.type) args.push("--type", options.type);
    if (options.project) args.push("--project", options.project);
    if (options.force) args.push("--force");
    
    if (options.tags) {
      for (const tag of options.tags) {
        args.push("--tags", tag);
      }
    }
    
    if (options.merge_ids) args.push("--merge-ids", options.merge_ids.join(","));
    if (options.supersedes) {
      for (const id of options.supersedes) {
        args.push("--supersedes", id);
      }
    }
    if (options.see_also) args.push("--see-also", options.see_also.join(","));

    const envelope = await this.exec(args);
    
    if (envelope.status === "skip") {
      return {
        status: "skip",
        candidates: envelope.details?.candidates,
        message: "Candidates found, not written. Choose: edit > merge > attach > force store",
      };
    }
    
    return {
      status: "ok",
      id: envelope.summary?.id,
    };
  }

  async forget(id: string): Promise<void> {
    await this.exec(["forget", id]);
  }

  async list(options: { limit?: number; since?: string } = {}): Promise<MemoryEntry[]> {
    const args = ["list"];
    if (options.limit) args.push("--limit", options.limit.toString());
    if (options.since) args.push("--since", options.since);
    
    const envelope = await this.exec(args);
    return envelope.details ?? [];
  }

  async diary(options: { limit?: number; date?: string } = {}): Promise<MemoryEntry[]> {
    const args = ["diary"];
    if (options.limit) args.push("--limit", options.limit.toString());
    if (options.date) args.push("--date", options.date);
    
    const envelope = await this.exec(args);
    return envelope.details ?? [];
  }

  private async fetch(
    method: string,
    path: string,
    body?: string,
    timeout?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout ?? this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
        signal: controller.signal,
        redirect: "manual",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${text.slice(0, 500)}`,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout");
        }
        if (error.message.includes("ECONNREFUSED")) {
          throw new Error(
            "Respire runtime not running (connection refused)",
          );
        }
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async ensureRuntime(): Promise<void> {
    try {
      await this.health();
    } catch {
      const autostart = process.env.RSRS_NO_AUTOSTART !== "1";
      const clientOnly = process.env.RSRS_CLIENT_ONLY === "1";
      
      if (!autostart || clientOnly) {
        throw new Error(
          "Respire runtime unavailable and autostart disabled",
        );
      }

      try {
        const { execSync } = await import("node:child_process");
        execSync("rsrs --json status", {
          stdio: "pipe",
          timeout: 60000,
        });
        
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.health();
      } catch {
        throw new Error(
          "Failed to start Respire runtime",
        );
      }
    }
  }
}
