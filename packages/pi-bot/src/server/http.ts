import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Daemon } from "../daemon.js";
import type { APIResponse } from "@pi-bot/protocol";
import { createBot, updateBot, deleteBot, getBot, listBots } from "../store.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  daemon: Daemon;
}

export async function serve(options: ServerOptions): Promise<void> {
  const port = options.port ?? 8787;
  const host = options.host ?? "127.0.0.1";
  const { daemon } = options;

  const server = createServer((req, res) => {
    handleRequest(req, res, daemon).catch((error) => {
      console.error("Request error:", error);
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: String(error) }));
    });
  });

  server.listen(port, host, () => {
    console.log(`pi-bot server listening on http://${host}:${port}`);
    console.log("\nAPI endpoints:");
    console.log("  Bots:");
    console.log("    GET  /api/bots           - List all bots");
    console.log("    POST /api/bots           - Create a new bot");
    console.log("    GET  /api/bots/:id       - Get bot details");
    console.log("    PUT  /api/bots/:id       - Update bot");
    console.log("    DELETE /api/bots/:id     - Delete bot");
    console.log("  Chat:");
    console.log("    POST /api/chat           - Send message to bot");
    console.log("    GET  /api/chat/stream    - SSE stream for live updates");
    console.log("  Schedules:");
    console.log("    GET  /api/schedules      - List schedules");
    console.log("    POST /api/schedules      - Create schedule");
    console.log("    PUT  /api/schedules/:id  - Update schedule");
    console.log("    DELETE /api/schedules/:id - Delete schedule");
    console.log("  Secrets:");
    console.log("    GET  /api/secrets        - List secrets");
    console.log("    POST /api/secrets        - Create secret");
    console.log("    DELETE /api/secrets/:key - Delete secret");
    console.log("  Usage:");
    console.log("    GET  /api/usage          - Query usage records");
    console.log("    GET  /api/usage/stats    - Get usage statistics");
    console.log("\nPress Ctrl+C to stop");
  });

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await daemon.shutdown();
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  daemon: Daemon,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const state = daemon.getState();

  if (req.method === "GET" && url.pathname === "/api/bots") {
    const bots = listBots(state);
    respond(res, 200, { ok: true, data: bots });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bots") {
    const body = await readBody(req);
    const spec = JSON.parse(body);
    const bot = createBot(state, spec);
    respond(res, 201, { ok: true, data: bot });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/bots/")) {
    const id = url.pathname.slice("/api/bots/".length);
    const bot = getBot(state, id);
    
    if (!bot) {
      respond(res, 404, { ok: false, error: "Bot not found" });
      return;
    }
    
    respond(res, 200, { ok: true, data: bot });
    return;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/bots/")) {
    const id = url.pathname.slice("/api/bots/".length);
    const body = await readBody(req);
    const updates = JSON.parse(body);
    const bot = updateBot(state, id, updates);
    
    if (!bot) {
      respond(res, 404, { ok: false, error: "Bot not found" });
      return;
    }
    
    respond(res, 200, { ok: true, data: bot });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/bots/")) {
    const id = url.pathname.slice("/api/bots/".length);
    const deleted = deleteBot(state, id);
    
    if (!deleted) {
      respond(res, 404, { ok: false, error: "Bot not found" });
      return;
    }
    
    respond(res, 200, { ok: true, data: { deleted: true } });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await readBody(req);
    const { botId, content } = JSON.parse(body);
    
    if (!botId || !content) {
      respond(res, 400, { ok: false, error: "Missing botId or content" });
      return;
    }

    const bot = getBot(state, botId);
    if (!bot) {
      respond(res, 404, { ok: false, error: "Bot not found" });
      return;
    }

    try {
      const result = await daemon.sendMessage(botId, content);
      respond(res, 200, { ok: true, data: result });
    } catch (error) {
      respond(res, 500, { ok: false, error: String(error) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/schedules") {
    respond(res, 200, { ok: true, data: state.schedules });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/schedules") {
    const body = await readBody(req);
    const spec = JSON.parse(body);
    
    try {
      const schedule = daemon.createSchedule(spec);
      respond(res, 201, { ok: true, data: schedule });
    } catch (error) {
      respond(res, 400, { ok: false, error: String(error) });
    }
    return;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/schedules/")) {
    const id = url.pathname.slice("/api/schedules/".length);
    const body = await readBody(req);
    const updates = JSON.parse(body);
    
    try {
      const schedule = daemon.updateSchedule(id, updates);
      if (!schedule) {
        respond(res, 404, { ok: false, error: "Schedule not found" });
        return;
      }
      respond(res, 200, { ok: true, data: schedule });
    } catch (error) {
      respond(res, 400, { ok: false, error: String(error) });
    }
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/schedules/")) {
    const id = url.pathname.slice("/api/schedules/".length);
    const deleted = daemon.deleteSchedule(id);
    
    if (!deleted) {
      respond(res, 404, { ok: false, error: "Schedule not found" });
      return;
    }
    
    respond(res, 200, { ok: true, data: { deleted: true } });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/secrets") {
    const secrets = daemon.getSecrets();
    respond(res, 200, { ok: true, data: secrets.list() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/secrets") {
    const body = await readBody(req);
    const { key, value, description } = JSON.parse(body);
    
    if (!key || !value) {
      respond(res, 400, { ok: false, error: "Missing key or value" });
      return;
    }

    const secrets = daemon.getSecrets();
    await secrets.set(key, value, description);
    respond(res, 201, { ok: true, data: { key, created: true } });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/secrets/")) {
    const key = url.pathname.slice("/api/secrets/".length);
    const secrets = daemon.getSecrets();
    const deleted = await secrets.delete(key);
    
    if (!deleted) {
      respond(res, 404, { ok: false, error: "Secret not found" });
      return;
    }
    
    respond(res, 200, { ok: true, data: { deleted: true } });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/usage") {
    const botId = url.searchParams.get("botId") ?? undefined;
    const model = url.searchParams.get("model") ?? undefined;
    const since = url.searchParams.get("since") ? Number(url.searchParams.get("since")) : undefined;
    const until = url.searchParams.get("until") ? Number(url.searchParams.get("until")) : undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;

    const usage = daemon.getUsage();
    const records = usage.query({ botId, model, since, until, limit });
    respond(res, 200, { ok: true, data: records });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/usage/stats") {
    const botId = url.searchParams.get("botId") ?? undefined;
    const model = url.searchParams.get("model") ?? undefined;
    const since = url.searchParams.get("since") ? Number(url.searchParams.get("since")) : undefined;
    const until = url.searchParams.get("until") ? Number(url.searchParams.get("until")) : undefined;

    const usage = daemon.getUsage();
    const stats = usage.getStats({ botId, model, since, until });
    respond(res, 200, { ok: true, data: stats });
    return;
  }

  respond(res, 404, { ok: false, error: "Not found" });
}

function respond<T>(res: ServerResponse, status: number, data: APIResponse<T>): void {
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}
