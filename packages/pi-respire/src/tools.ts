/**
 * Register memory tools with pi
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import type { RespireClient } from '@pi-bot/respire-client';
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
    promptGuidelines:
      'Always call this tool first in every turn, before any other tool. ' +
      'Use it to check existing knowledge before making decisions or storing new information.',
    async execute(input) {
      try {
        const result = await client.recall(input.query, {
          limit: input.limit ?? 20,
          titles: input.titles ?? true,
          project: input.project ?? options.scope,
        });

        if (result.count === 0) {
          return {
            content: `No memories found for query: "${input.query}"`,
            details: { result },
          };
        }

        const items = result.details
          .map((d, i) => `${i + 1}. [${d.id.slice(0, 8)}] ${d.title} (score: ${d.score.toFixed(3)})`)
          .join('\n');

        let content = `Found ${result.count} memories:\n\n${items}`;

        if (result.related && result.related.length > 0) {
          content += '\n\nRelated: ' + result.related.join(', ');
        }

        return {
          content,
          details: { result },
        };
      } catch (error) {
        return {
          content: `Recall failed: ${error instanceof Error ? error.message : String(error)}`,
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
    description: 'Show full content of a specific memory entry by ID',
    parameters: Type.Object({
      id: Type.String({
        description: 'Memory entry ID (full or 8-char prefix)',
      }),
    }),
    async execute(input) {
      try {
        const entry = await client.show(input.id);

        if (!entry) {
          return {
            content: `Memory entry not found: ${input.id}`,
          };
        }

        return {
          content:
            `# ${entry.title || 'Untitled'}\n\n` +
            `${entry.content}\n\n` +
            `---\n` +
            `ID: ${entry.id}\n` +
            `Created: ${entry.created_at}\n` +
            (entry.project ? `Project: ${entry.project}\n` : ''),
          details: { entry },
        };
      } catch (error) {
        return {
          content: `Failed to show entry: ${error instanceof Error ? error.message : String(error)}`,
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
    async execute(input) {
      if (!canWrite()) {
        return {
          content: 'Memory system is in readonly or off mode. Cannot write.',
          isError: true,
        };
      }

      try {
        const result = await client.remember(input.content, {
          title: input.title,
          importance: input.importance ?? 'trivial',
          force: input.force ?? false,
          project: options.scope,
        });

        if (result.candidates && result.candidates.length > 0) {
          const items = result.candidates
            .map((c, i) => `${i + 1}. [${c.id.slice(0, 8)}] ${c.content.slice(0, 100)}...`)
            .join('\n');

          return {
            content:
              `Similar memories already exist:\n\n${items}\n\n` +
              `Not stored yet. Please decide:\n` +
              `- Edit (modify your content and retry)\n` +
              `- Merge (call remember with --merge-ids)\n` +
              `- Attach (call remember with --parent)\n` +
              `- Force (call remember with --force)`,
            details: { result },
          };
        }

        return {
          content:
            `Stored memory: [${result.id?.slice(0, 8)}] ${input.title}\n\n` +
            `This entry will appear in system prompt on next session. ` +
            `It's immediately searchable via respire_recall.`,
          details: { result },
        };
      } catch (error) {
        return {
          content: `Failed to store: ${error instanceof Error ? error.message : String(error)}`,
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
      description: 'Delete a memory entry by ID (tombstone)',
      parameters: Type.Object({
        id: Type.String({
          description: 'Memory entry ID to delete',
        }),
      }),
      async execute(input) {
        try {
          const success = await client.forget(input.id);

          return {
            content: success
              ? `Deleted memory: ${input.id}`
              : `Failed to delete memory: ${input.id}`,
            isError: !success,
          };
        } catch (error) {
          return {
            content: `Failed to forget: ${error instanceof Error ? error.message : String(error)}`,
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
    description: 'List recent memory entries',
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: 'Max entries to return (default 20)',
          default: 20,
        })
      ),
    }),
    async execute(input) {
      try {
        const entries = await client.list({ limit: input.limit ?? 20 });

        if (entries.length === 0) {
          return { content: 'No memories found' };
        }

        const items = entries
          .map((e, i) => `${i + 1}. [${e.id.slice(0, 8)}] ${e.title || e.content.slice(0, 50)}`)
          .join('\n');

        return {
          content: `Recent memories:\n\n${items}`,
          details: { entries },
        };
      } catch (error) {
        return {
          content: `Failed to list: ${error instanceof Error ? error.message : String(error)}`,
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
    description: 'List recent trivial/diary entries (chronological)',
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: 'Max entries to return (default 10)',
          default: 10,
        })
      ),
    }),
    async execute(input) {
      try {
        const entries = await client.diary(input.limit ?? 10);

        if (entries.length === 0) {
          return { content: 'No diary entries found' };
        }

        const items = entries
          .map((e, i) => `${i + 1}. [${e.id.slice(0, 8)}] ${e.title || e.content.slice(0, 50)}`)
          .join('\n');

        return {
          content: `Recent diary:\n\n${items}`,
          details: { entries },
        };
      } catch (error) {
        return {
          content: `Failed to get diary: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
  });
}
