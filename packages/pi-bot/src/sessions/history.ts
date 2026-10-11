/**
 * Session history reader - reads chat history from pi session JSONL files
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ChatHistory {
  messages: ChatMessage[];
  totalMessages: number;
}

/**
 * Read chat history from pi session JSONL file
 */
export async function readChatHistory(
  sessionDir: string,
  botId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<ChatHistory> {
  const { limit = 50, offset = 0 } = options;

  try {
    // Find the most recent session file for this bot
    const sessionPath = join(sessionDir, 'bots', botId);
    const sessionFile = join(sessionPath, 'session.jsonl');

    // Read JSONL file
    const content = await readFile(sessionFile, 'utf-8');
    const lines = content.trim().split('\n');

    // Parse entries and extract messages
    const messages: ChatMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);

        // Extract messages from different entry types
        if (entry.type === 'message') {
          const message = entry.message;
          if (message.role === 'user' || message.role === 'assistant') {
            messages.push({
              id: message.id || `msg-${messages.length}`,
              role: message.role,
              text: message.text || '',
              timestamp: Date.now(), // TODO: extract from entry
              metadata: message.metadata,
            });
          }
        }
      } catch (error) {
        console.warn('Failed to parse JSONL line:', error);
        continue;
      }
    }

    // Apply pagination
    const totalMessages = messages.length;
    const paginatedMessages = messages.slice(offset, offset + limit);

    return {
      messages: paginatedMessages,
      totalMessages,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Session file doesn't exist yet
      return {
        messages: [],
        totalMessages: 0,
      };
    }
    throw error;
  }
}
