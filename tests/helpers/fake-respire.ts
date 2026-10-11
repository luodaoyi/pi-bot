/**
 * Minimal Respire HTTP RPC stand-in that returns real 1.0.13-dev.4 envelope shapes.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  HEALTH_OK,
  LIST_ENTRIES,
  LIST_LIMIT_3,
  RECALL_FULL_HITS,
  RECALL_SKIP,
  RECALL_TITLES_HITS,
  SHOW_ENTRY,
  STATUS_OK,
} from '../fixtures/respire-envelopes.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function stripJson(args: string[]): string[] {
  return args[0] === '--json' ? args.slice(1) : args;
}

export function handleRpc(args: string[]): unknown {
  const argv = stripJson(args);
  const cmd = argv[0] ?? '';

  if (cmd === 'status') return STATUS_OK;
  if (cmd === 'list') {
    const limitIdx = argv.indexOf('--limit');
    const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : LIST_ENTRIES.length;
    const details = LIST_ENTRIES.slice(0, Number.isFinite(limit) ? limit : LIST_ENTRIES.length);
    return {
      ...LIST_LIMIT_3,
      envelope: {
        ...LIST_LIMIT_3.envelope,
        summary: { ...LIST_LIMIT_3.envelope.summary, count: details.length, limit },
        details,
      },
    };
  }
  if (cmd === 'show') {
    const id = argv[1];
    const entry = LIST_ENTRIES.find((item) => item.id === id) ?? LIST_ENTRIES[0];
    return {
      ...SHOW_ENTRY,
      envelope: { ...SHOW_ENTRY.envelope, details: entry, summary: { id: entry?.id } },
    };
  }
  if (cmd === 'recall') {
    const query = argv[1] ?? '';
    const titles = argv.includes('--titles');
    const quality = argv.includes('quality');
    if (/文档|respire/i.test(query)) {
      return titles || !quality ? RECALL_TITLES_HITS : RECALL_FULL_HITS;
    }
    return {
      ...RECALL_SKIP,
      envelope: {
        ...RECALL_SKIP.envelope,
        summary: { ...RECALL_SKIP.envelope.summary, query },
      },
    };
  }
  if (cmd === 'remember') {
    return {
      v: 1,
      id: 'remember-id',
      ok: true,
      exit: 0,
      bin: '1.0.13-dev.4',
      envelope: {
        command: 'remember',
        status: 'ok',
        summary: { id: 'new-mem-id', message: 'Stored' },
        errors: [],
        details: null,
      },
      error: null,
    };
  }
  if (cmd === 'forget') {
    return {
      v: 1,
      id: 'forget-id',
      ok: true,
      exit: 0,
      bin: '1.0.13-dev.4',
      envelope: { command: 'forget', status: 'ok', errors: [], details: null },
      error: null,
    };
  }

  return {
    v: 1,
    id: 'unknown',
    ok: false,
    exit: 1,
    bin: '1.0.13-dev.4',
    envelope: {
      command: cmd,
      status: 'fail',
      errors: [`unknown command ${cmd}`],
      details: null,
    },
    error: `unknown command ${cmd}`,
    code: 'unknown',
  };
}

export function startFakeRespire(port = 0): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/api/health') {
        const addr = server.address();
        const bound = typeof addr === 'object' && addr ? addr.port : port;
        json(res, 200, { ...HEALTH_OK, url: `http://127.0.0.1:${bound}` });
        return;
      }
      if (req.method === 'POST' && req.url === '/api/rpc') {
        const body = JSON.parse((await readBody(req)) || '{}') as { args?: string[] };
        json(res, 200, handleRpc(body.args ?? []));
        return;
      }
      json(res, 404, { error: 'not found' });
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : 'fake respire failed' });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const bound = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, port: bound });
    });
  });
}

export async function stopFakeRespire(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
