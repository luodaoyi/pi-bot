import { describe, expect, it } from 'vitest';
import {
  LIST_LIMIT_3,
  RECALL_FULL_HITS,
  RECALL_SKIP,
  RECALL_TITLES_HITS,
  RPC_OK_FALSE,
  SHOW_ENTRY,
  SHOW_WRAPPED_ENTRY,
  STATUS_OK,
} from '../../tests/fixtures/respire-envelopes.js';
import {
  assertRpcSuccess,
  extractStatusCounts,
  listEntriesFromEnvelope,
  parseListDetails,
  parseRecallDetails,
  parseShowDetails,
  recallEntriesFromEnvelope,
} from './envelopes.js';
import type { RpcResponse } from './types.js';

describe('parseListDetails (real envelope)', () => {
  it('reads envelope.details as an array, not details.entries', () => {
    const details = LIST_LIMIT_3.envelope.details;
    expect(Array.isArray(details)).toBe(true);
    // This is the beta.6 landmine: Array.prototype.entries is a function.
    expect(typeof (details as unknown[] & { entries: unknown }).entries).toBe('function');
    const entries = parseListDetails(details);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.title).toBe('Respire中英文文档已自动发布上线验收');
    expect(entries[0]?.kind).toBe('Context');
    expect(entries[0]?.importance).toBe('important');
    expect(entries[2]?.project).toBe('pi-bot');
  });

  it('treats skip as empty', () => {
    expect(listEntriesFromEnvelope({ command: 'list', status: 'skip', details: null })).toEqual([]);
  });
});

describe('parseRecallDetails (real envelopes)', () => {
  it('treats status skip + details null as empty, not an error', () => {
    const parsed = recallEntriesFromEnvelope(RECALL_SKIP.envelope, 'pi-bot');
    expect(parsed.count).toBe(0);
    expect(parsed.details).toEqual([]);
    expect(parsed.query).toBe('pi-bot');
    expect(() => assertRpcSuccess(RECALL_SKIP as unknown as RpcResponse)).not.toThrow();
  });

  it('parses --titles hits {id,title,score}', () => {
    const details = parseRecallDetails(RECALL_TITLES_HITS.envelope.details);
    expect(details).toHaveLength(2);
    expect(details[0]?.id).toBe('d76f9bd3-1111-4111-8111-111111111111');
    expect(details[0]?.title).toContain('Respire');
    expect(details[0]?.score).toBeCloseTo(0.91);
  });

  it('parses full hits {score,entry:{...list fields}}', () => {
    const details = parseRecallDetails(RECALL_FULL_HITS.envelope.details);
    expect(details).toHaveLength(1);
    expect(details[0]?.id).toBe('d76f9bd3-1111-4111-8111-111111111111');
    expect(details[0]?.content).toContain('Acceptance notes');
    expect(details[0]?.kind).toBe('Context');
    expect(details[0]?.importance).toBe('important');
  });
});

describe('parseShowDetails', () => {
  it('accepts a bare entry as details', () => {
    const entry = parseShowDetails(SHOW_ENTRY.envelope.details);
    expect(entry?.id).toBe('d76f9bd3-1111-4111-8111-111111111111');
    expect(entry?.content).toContain('# Respire docs shipped');
  });

  it('accepts { entry } wrapped details', () => {
    const entry = parseShowDetails(SHOW_WRAPPED_ENTRY.envelope.details);
    expect(entry?.title).toBe('Respire中英文文档已自动发布上线验收');
  });
});

describe('assertRpcSuccess', () => {
  it('surfaces ok:false / error / errors[] as real errors', () => {
    expect(() => assertRpcSuccess(RPC_OK_FALSE as unknown as RpcResponse)).toThrow(/index unavailable/);
  });
});

describe('extractStatusCounts', () => {
  it('reads local_alive etc. from status summary', () => {
    const counts = extractStatusCounts(STATUS_OK.envelope.summary as Record<string, unknown>);
    expect(counts.local_alive).toBe(3383);
    expect(counts.local_tombstone).toBe(12);
    expect(counts.indexed).toBe(3383);
  });
});
