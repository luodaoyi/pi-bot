/**
 * Parse real Respire cli.exec --json envelopes.
 *
 * list details is an ARRAY of entries. Do not read `.entries` on that array —
 * Array.prototype.entries is a method, which produced
 * `listed.map is not a function` on beta.6.
 */
import { RespireError } from './errors.js';
import type { MemoryEntry, RecallDetail, ResultEnvelope, RpcResponse } from './types.js';

export function assertRpcSuccess(response: RpcResponse): ResultEnvelope {
  if (response.ok === false) {
    throw new RespireError(
      response.error || joinErrors(response.envelope?.errors) || 'Respire RPC failed',
      (response.code as never) ?? 'unknown',
      response
    );
  }
  if (typeof response.error === 'string' && response.error.length > 0) {
    throw new RespireError(response.error, (response.code as never) ?? 'unknown', response);
  }
  const envelope = response.envelope;
  if (!envelope) {
    throw new RespireError(
      response.error ?? 'Empty response',
      (response.code as never) ?? 'unknown',
      response
    );
  }
  const listedErrors = joinErrors(envelope.errors);
  if (listedErrors) {
    throw new RespireError(listedErrors, (response.code as never) ?? 'unknown', response);
  }
  if (envelope.status === 'fail') {
    throw new RespireError(
      response.error || listedErrors || 'Respire command failed',
      (response.code as never) ?? 'unknown',
      response
    );
  }
  return envelope;
}

function joinErrors(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) return '';
  return errors.map((item) => String(item)).filter(Boolean).join('; ');
}

export function normalizeMemoryEntry(raw: unknown): MemoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const id = rec.id != null ? String(rec.id) : rec.title != null ? String(rec.title) : '';
  if (!id) return null;
  return {
    id,
    kind: rec.kind != null ? String(rec.kind) : undefined,
    title: rec.title != null ? String(rec.title) : undefined,
    content: rec.content != null ? String(rec.content) : '',
    created_at: rec.created_at != null ? String(rec.created_at) : new Date().toISOString(),
    updated_at: rec.updated_at != null ? String(rec.updated_at) : undefined,
    project: rec.project != null ? String(rec.project) : undefined,
    importance: rec.importance != null ? String(rec.importance) : undefined,
    parent_id: rec.parent_id != null ? String(rec.parent_id) : undefined,
  };
}

/**
 * list: details is MemoryEntry[] (NOT { entries: [] }).
 * A leftover `{ entries }` object is still accepted.
 */
export function parseListDetails(details: unknown): MemoryEntry[] {
  if (details == null) return [];
  if (Array.isArray(details)) {
    return details.map(normalizeMemoryEntry).filter((entry): entry is MemoryEntry => entry !== null);
  }
  if (typeof details === 'object') {
    const rec = details as Record<string, unknown>;
    if (Array.isArray(rec.entries)) {
      return rec.entries.map(normalizeMemoryEntry).filter((entry): entry is MemoryEntry => entry !== null);
    }
  }
  return [];
}

export function listEntriesFromEnvelope(envelope: ResultEnvelope): MemoryEntry[] {
  if (envelope.status === 'skip') return [];
  return parseListDetails(envelope.details);
}

export function parseRecallDetails(details: unknown): RecallDetail[] {
  if (details == null) return [];
  if (!Array.isArray(details)) return [];
  const out: RecallDetail[] = [];
  for (const item of details) {
    const hit = normalizeRecallHit(item);
    if (hit) out.push(hit);
  }
  return out;
}

function normalizeRecallHit(item: unknown): RecallDetail | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;

  if (rec.entry && typeof rec.entry === 'object') {
    const entry = normalizeMemoryEntry(rec.entry);
    if (!entry) return null;
    return {
      id: entry.id,
      title: entry.title ?? '',
      score: Number(rec.score ?? 0),
      content: entry.content,
      superseded_by: rec.superseded_by != null ? String(rec.superseded_by) : undefined,
      kind: entry.kind,
      importance: entry.importance,
      project: entry.project,
      updated_at: entry.updated_at,
      created_at: entry.created_at,
    };
  }

  if (rec.id != null || rec.title != null) {
    return {
      id: String(rec.id ?? rec.title),
      title: rec.title != null ? String(rec.title) : '',
      score: Number(rec.score ?? 0),
      content: rec.content != null ? String(rec.content) : undefined,
      superseded_by: rec.superseded_by != null ? String(rec.superseded_by) : undefined,
      kind: rec.kind != null ? String(rec.kind) : undefined,
      importance: rec.importance != null ? String(rec.importance) : undefined,
      project: rec.project != null ? String(rec.project) : undefined,
      updated_at: rec.updated_at != null ? String(rec.updated_at) : undefined,
      created_at: rec.created_at != null ? String(rec.created_at) : undefined,
    };
  }

  return null;
}

export function recallEntriesFromEnvelope(envelope: ResultEnvelope, query = ''): {
  query: string;
  count: number;
  details: RecallDetail[];
} {
  if (envelope.status === 'skip') {
    return {
      query: String(envelope.summary?.['query'] ?? query),
      count: 0,
      details: [],
    };
  }
  const details = parseRecallDetails(envelope.details);
  return {
    query: String(envelope.summary?.['query'] ?? query),
    count: Number(envelope.summary?.['count'] ?? details.length),
    details,
  };
}

export function parseShowDetails(details: unknown): MemoryEntry | null {
  if (details == null) return null;
  if (Array.isArray(details)) {
    return details.length ? normalizeMemoryEntry(details[0]) : null;
  }
  if (typeof details === 'object') {
    const rec = details as Record<string, unknown>;
    if (rec.entry && typeof rec.entry === 'object') {
      return normalizeMemoryEntry(rec.entry);
    }
    return normalizeMemoryEntry(rec);
  }
  return null;
}

export function extractStatusCounts(status: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (obj: unknown, prefix = '') => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'number' && Number.isFinite(value)) {
        out[path] = value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value, path);
      }
    }
  };
  walk(status);
  return out;
}
