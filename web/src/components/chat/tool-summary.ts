import type { PiToolCall } from '@/api/types';
import { extractToolOutputText } from '@/api/normalize';

export function toolOneLineSummary(tool: PiToolCall): string {
  const args = tool.arguments ?? {};
  const keys = ['command', 'path', 'file_path', 'filePath', 'initialPrompt', 'name', 'message', 'query', 'cron'];
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim();
  }
  const first = Object.values(args).find((value) => typeof value === 'string' && value.trim());
  return typeof first === 'string' ? first.replace(/\s+/g, ' ').trim() : '';
}

export function countToolNames(tools: PiToolCall[]): string {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(', ');
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

export function plainToolOutput(tool: PiToolCall): string {
  return extractToolOutputText(tool.result ?? tool.liveOutput ?? '');
}

export function parseCreatedSession(tool: PiToolCall): { sessionId: string; botId?: string; name?: string } | null {
  if (tool.name !== 'pibot_create_session') return null;
  const fromArgs = typeof tool.arguments?.sessionId === 'string' ? tool.arguments.sessionId : '';
  const sources = [tool.result, tool.liveOutput];
  for (const raw of sources) {
    if (!raw) continue;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === 'object') {
        const rec = parsed as Record<string, unknown>;
        const details = rec.details && typeof rec.details === 'object' ? (rec.details as Record<string, unknown>) : rec;
        const sessionId = String(details.sessionId ?? fromArgs ?? '');
        if (sessionId) {
          return {
            sessionId,
            botId: typeof details.botId === 'string' ? details.botId : undefined,
            name: typeof details.name === 'string' ? details.name : undefined,
          };
        }
      }
    } catch {
      const match = String(raw).match(/sessionId=([A-Za-z0-9_-]+)/);
      if (match?.[1]) return { sessionId: match[1] };
    }
  }
  if (fromArgs) return { sessionId: fromArgs };
  return null;
}
