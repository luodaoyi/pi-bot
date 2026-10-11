/**
 * Register memory tools with pi
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import type { RespireClient } from '#respire-client/index.js';
import type { RespireExtensionOptions, BootState, GateState } from './types.js';

interface ToolContext {
  getBootState: () => BootState | null;
  getGateState: () => GateState;
}

export function registerMemoryTools(
  pi: ExtensionAPI,
  client: RespireClient,
  options: Required<RespireExtensionOptions>,
  ctx: ToolContext
) {
  // Helper to check if write operations are allowed
  const canWrite = () => {
    const boot = ctx.getBootState();
    return boot?.mode === 'normal';
  };

  // ============================================================================
  // respire_recall
  // ============================================================================

  pi.registerTool({
    name: 'respire_recall',
    label: 'Respire Recall',
    description:
      'Semantic recall from Respire memory. ' +
      'This MUST be the first tool called in every turn. ' +
      'Use --titles mode for fast scanning, then show specific entries.',
    parameters: Type.Object({
      query: Type.String({
        description: 'Query string (keywords or natural language)',
      }),
      limit: Type.Optional(
        Type.Number({
          description: 'Max results to return (default 20)',
          default: 20,
        })
      ),
      titles: Type.Optional(
        Type.Boolean({
          description: 'Return only titles for fast scanning (default true)',
          default: true,
        })
      ),
      project: Type.Optional(
        Type.String({
          description: 'Filter by project/scope',
        })
      ),
    }),
    promptGuidelines: [
      'Always call this tool first in every turn, before any other tool',
      'Use it to check existing knowledge before making decisions or storing new information',
    ],
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const result = await client.recall(params.query, {
          limit: params.limit ?? 20,
          titles: params.titles ?? true,
          project: params.project ?? options.scope,
        });

        if (result.count === 0) {
          return {
            content: [{ type: 'text' as const, text: `No memories found for query: "${params.query}"` }],
            details: { result },
          };
        }

        const items = result.details
          .map((d, i) => `${i + 1}. [${d.id.slice(0, 8)}] ${d.title} (score: ${d.score.toFixed(3)})`)
          .join('\n');

        let text = `Found ${result.count} memories:\n\n${items}`;

        if (result.related && result.related.length > 0) {
          text += '\n\nRelated: ' + result.related.join(', ');
        }

        return {
          content: [{ type: 'text' as const, text }],
          details: { result },
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Recall failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  // ============================================================================
  // respire_show
  // ============================================================================

  pi.registerTool({
    name: 'respire_show',
    label: 'Respire Show',
    description: 'Show full content of a specific memory entry by ID',
    parameters: Type.Object({
      id: Type.String({
        description: 'Memory entry ID (full or 8-char prefix)',
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const entry = await client.show(params.id);

        if (!entry) {
          return {
            content: [{ type: 'text' as const, text: `Memory entry not found: ${params.id}` }],
            details: {},
          };
        }

        const text =
          `# ${entry.title || 'Untitled'}\n\n` +
          `${entry.content}\n\n` +
          `---\n` +
          `ID: ${entry.id}\n` +
          `Created: ${entry.created_at}\n` +
          (entry.project ? `Project: ${entry.project}\n` : '');

        return {
          content: [{ type: 'text' as const, text }],
          details: { entry },
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to show entry: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  // ============================================================================
  // respire_remember
  // ============================================================================

  pi.registerTool({
    name: 'respire_remember',
    label: 'Respire Remember',
    description:
      'Store a memory entry. ' +
      'Will return candidates if similar entries exist (judge-then-store). ' +
      'Format: [前因] [行为] [后果]',
    parameters: Type.Object({
      content: Type.String({
        description: 'Memory content (max 300 chars, Chinese OK)',
        maxLength: 300,
      }),
      title: Type.String({
        description: 'Brief title summarizing this memory',
      }),
      importance: Type.Optional(
        Type.Union([Type.Literal('important'), Type.Literal('trivial')], {
          description: 'Importance level (default: trivial)',
          default: 'trivial',
        })
      ),
      force: Type.Optional(
        Type.Boolean({
          description: 'Force write even if candidates exist',
          default: false,
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      if (!canWrite()) {
        return {
          content: [
            { type: 'text' as const, text: 'Memory system is in readonly or off mode. Cannot write.' },
          ],
          details: {},
          isError: true,
        };
      }

      try {
        const result = await client.remember(params.content, {
          title: params.title,
          importance: params.importance ?? 'trivial',
          force: params.force ?? false,
          project: options.scope,
        });

        if (result.candidates && result.candidates.length > 0) {
          const items = result.candidates
            .map((c, i) => `${i + 1}. [${c.id.slice(0, 8)}] ${c.content.slice(0, 100)}...`)
            .join('\n');

          const text =
            `Similar memories already exist:\n\n${items}\n\n` +
            `Not stored yet. Please decide:\n` +
            `- Edit (modify your content and retry)\n` +
            `- Merge (call remember with --merge-ids)\n` +
            `- Attach (call remember with --parent)\n` +
            `- Force (call remember with --force)`;

          return {
            content: [{ type: 'text' as const, text }],
            details: { result },
          };
        }

        const text =
          `Stored memory: [${result.id?.slice(0, 8)}] ${params.title}\n\n` +
          `This entry will appear in system prompt on next session. ` +
          `It's immediately searchable via respire_recall.`;

        return {
          content: [{ type: 'text' as const, text }],
          details: { result },
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to store: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  // ============================================================================
  // respire_forget
  // ============================================================================

  if (canWrite()) {
    pi.registerTool({
      name: 'respire_forget',
      label: 'Respire Forget',
      description: 'Delete a memory entry by ID (tombstone)',
      parameters: Type.Object({
        id: Type.String({
          description: 'Memory entry ID to delete',
        }),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          const success = await client.forget(params.id);

          return {
            content: [
              {
                type: 'text' as const,
                text: success ? `Deleted memory: ${params.id}` : `Failed to delete memory: ${params.id}`,
              },
            ],
            details: {},
            isError: !success,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to forget: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: {},
            isError: true,
          };
        }
      },
    });
  }

  // ============================================================================
  // respire_list
  // ============================================================================

  pi.registerTool({
    name: 'respire_list',
    label: 'Respire List',
    description: 'List recent memory entries',
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: 'Max entries to return (default 20)',
          default: 20,
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const entries = await client.list({ limit: params.limit ?? 20 });

        if (entries.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No memories found' }], details: {} };
        }

        const items = entries
          .map((e, i) => `${i + 1}. [${e.id.slice(0, 8)}] ${e.title || e.content.slice(0, 50)}`)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Recent memories:\n\n${items}` }],
          details: { entries },
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to list: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  // ============================================================================
  // respire_diary
  // ============================================================================

  pi.registerTool({
    name: 'respire_diary',
    label: 'Respire Diary',
    description: 'List recent trivial/diary entries (chronological)',
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: 'Max entries to return (default 10)',
          default: 10,
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const entries = await client.diary(params.limit ?? 10);

        if (entries.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No diary entries found' }], details: {} };
        }

        const items = entries
          .map((e, i) => `${i + 1}. [${e.id.slice(0, 8)}] ${e.title || e.content.slice(0, 50)}`)
          .join('\n');

        return {
          content: [{ type: 'text' as const, text: `Recent diary:\n\n${items}` }],
          details: { entries },
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get diary: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });
}
