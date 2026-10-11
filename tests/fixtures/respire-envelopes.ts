/**
 * Real Respire 1.0.13-dev.4 cli.exec --json envelopes
 * (strings redacted from a Windows capture; shapes unchanged).
 */

const LIST_ENTRY_1 = {
  computer: 'TB16P/win',
  content: '# Respire docs shipped\n\nAcceptance notes for the bilingual site.',
  created_at: '2026-10-11T07:27:13.085Z',
  device: 'TB16P/win',
  emotion: -1.0,
  id: 'd76f9bd3-1111-4111-8111-111111111111',
  importance: 'important',
  kind: 'Context',
  modified_by: 'TB16P/win',
  parent_id: 'bbbbbbbb-1111-4111-8111-111111111111',
  project: '',
  tags: [] as string[],
  title: 'Respire中英文文档已自动发布上线验收',
  updated_at: '2026-10-11T14:42:12.799Z',
  user: 'local',
};

const LIST_ENTRY_2 = {
  computer: 'TB16P/win',
  content: 'Second memory body used as a list fixture.',
  created_at: '2026-10-10T16:15:25.708Z',
  device: 'TB16P/win',
  emotion: 0.0,
  id: '4486bb67-2222-4222-8222-222222222222',
  importance: 'trivial',
  kind: 'Context',
  modified_by: 'TB16P/win',
  parent_id: '',
  project: '',
  tags: [] as string[],
  title: 'Weekly review notes',
  updated_at: '2026-10-11T14:33:34.008Z',
  user: 'asura',
};

const LIST_ENTRY_3 = {
  computer: 'TB16P/win',
  content: 'Third memory for paging fixtures.',
  created_at: '2026-10-09T10:00:00.000Z',
  device: 'TB16P/win',
  emotion: 0.0,
  id: 'aaaaaaaa-3333-4333-8333-333333333333',
  importance: 'trivial',
  kind: 'Note',
  modified_by: 'TB16P/win',
  parent_id: '',
  project: 'pi-bot',
  tags: [] as string[],
  title: 'Daemon version mismatch notes',
  updated_at: '2026-10-11T12:00:00.000Z',
  user: 'local',
};

export const LIST_ENTRIES = [LIST_ENTRY_1, LIST_ENTRY_2, LIST_ENTRY_3];

function rpcWrap(envelope: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    v: 1,
    id: '11111111-1111-4111-8111-111111111111',
    ok: true,
    exit: 0,
    bin: '1.0.13-dev.4',
    envelope,
    error: null,
    code: null,
    web_url: 'http://127.0.0.1:15169',
    pid: 35468,
    data_dir: '/Users/asura/.rsrs',
    ...extra,
  };
}

export const LIST_LIMIT_3 = rpcWrap({
  command: 'list',
  status: 'ok',
  summary: { count: 3, filter: null, limit: 3 },
  items: [
    { name: 'd76f9bd3', status: 'ok', value: LIST_ENTRY_1.title },
    { name: '4486bb67', status: 'ok', value: LIST_ENTRY_2.title },
    { name: 'aaaaaaaa', status: 'ok', value: LIST_ENTRY_3.title },
  ],
  actions: [],
  errors: [],
  details: LIST_ENTRIES,
  related: [],
});

export const RECALL_SKIP = rpcWrap({
  command: 'recall',
  status: 'skip',
  summary: {
    count: 0,
    embedding_model: 'm3',
    index_pending: 0,
    indexed_candidates: 3383,
    query: 'pi-bot',
    recall_mode: 'fast',
    routing: { ablate: '', route_on: true, temporal: false },
    selection_fallback: null,
  },
  items: [{ name: 'results', status: 'skip', value: '0' }],
  actions: [],
  errors: [],
  details: null,
  related: [],
});

export const RECALL_TITLES_HITS = rpcWrap({
  command: 'recall',
  status: 'ok',
  summary: {
    count: 2,
    embedding_model: 'm3',
    index_pending: 0,
    indexed_candidates: 3383,
    query: '文档',
    recall_mode: 'fast',
    routing: { ablate: '', route_on: true, temporal: false },
    selection_fallback: null,
  },
  items: [{ name: 'results', status: 'ok', value: '2' }],
  actions: [],
  errors: [],
  details: [
    {
      id: LIST_ENTRY_1.id,
      title: LIST_ENTRY_1.title,
      score: 0.91,
      superseded_by: null,
    },
    {
      id: LIST_ENTRY_3.id,
      title: LIST_ENTRY_3.title,
      score: 0.72,
      superseded_by: null,
    },
  ],
  related: [],
});

export const RECALL_FULL_HITS = rpcWrap({
  command: 'recall',
  status: 'ok',
  summary: {
    count: 1,
    embedding_model: 'm3',
    index_pending: 0,
    indexed_candidates: 3383,
    query: '文档',
    recall_mode: 'quality',
    routing: { ablate: '', route_on: true, temporal: false },
    selection_fallback: null,
  },
  items: [{ name: 'results', status: 'ok', value: '1' }],
  actions: [],
  errors: [],
  details: [
    {
      score: 0.91,
      entry: LIST_ENTRY_1,
      ancestors: [],
      superseded_by: null,
    },
  ],
  related: [],
});

export const SHOW_ENTRY = rpcWrap({
  command: 'show',
  status: 'ok',
  summary: { id: LIST_ENTRY_1.id },
  items: [],
  actions: [],
  errors: [],
  details: LIST_ENTRY_1,
  related: [],
});

export const SHOW_WRAPPED_ENTRY = rpcWrap({
  command: 'show',
  status: 'ok',
  summary: { id: LIST_ENTRY_1.id },
  items: [],
  actions: [],
  errors: [],
  details: { entry: LIST_ENTRY_1 },
  related: [],
});

export const STATUS_OK = rpcWrap({
  command: 'status',
  status: 'ok',
  summary: {
    local_alive: 3383,
    local_tombstone: 12,
    indexed: 3383,
    index_pending: 0,
  },
  items: [],
  actions: [],
  errors: [],
  details: null,
  related: [],
});

export const RPC_OK_FALSE = {
  v: 1,
  id: '22222222-2222-4222-8222-222222222222',
  ok: false,
  exit: 2,
  bin: '1.0.13-dev.4',
  envelope: {
    command: 'recall',
    status: 'fail',
    summary: {},
    items: [],
    actions: [],
    errors: ['index unavailable'],
    details: null,
    related: [],
  },
  error: 'index unavailable',
  code: 'index_unavailable',
  web_url: 'http://127.0.0.1:15169',
  pid: 35468,
  data_dir: '/Users/asura/.rsrs',
};

export const HEALTH_OK = {
  server: 'respire',
  bin: '1.0.13-dev.4',
  pid: 35468,
  v: 1,
  url: 'http://127.0.0.1:15169',
  exe: 'rsrs',
  data_dir: '/Users/asura/.rsrs',
};
