/**
 * Per-bot session index persisted next to SessionManager files.
 * Tracks sessions that exist before the first message is flushed to disk.
 */

import { mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWriteJson } from '#shared/index.js';
import type { BotModel, ThinkingLevel } from '#shared/index.js';

export interface IndexedSession {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  model?: BotModel;
  thinking?: ThinkingLevel | null;
}

interface IndexFile {
  activeId: string | null;
  sessions: Record<string, IndexedSession>;
}

export class SessionIndexStore {
  constructor(private readonly rootDir: string) {}

  private fileFor(botId: string): string {
    return join(this.rootDir, botId, 'index.json');
  }

  async load(botId: string): Promise<IndexFile> {
    try {
      const raw = await readFile(this.fileFor(botId), 'utf-8');
      const parsed = JSON.parse(raw) as IndexFile;
      return {
        activeId: parsed.activeId ?? null,
        sessions: parsed.sessions ?? {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      return { activeId: null, sessions: {} };
    }
  }

  async save(botId: string, index: IndexFile): Promise<void> {
    const dir = join(this.rootDir, botId);
    await mkdir(dir, { recursive: true });
    await atomicWriteJson(this.fileFor(botId), index);
  }

  async upsert(botId: string, session: IndexedSession, activate = false): Promise<IndexFile> {
    const index = await this.load(botId);
    const prev = index.sessions[session.id];
    index.sessions[session.id] = {
      ...prev,
      ...session,
      messageCount: session.messageCount ?? prev?.messageCount ?? 0,
    };
    if (activate || !index.activeId) {
      index.activeId = session.id;
    }
    await this.save(botId, index);
    return index;
  }

  async setActive(botId: string, sessionId: string | null): Promise<IndexFile> {
    const index = await this.load(botId);
    index.activeId = sessionId;
    await this.save(botId, index);
    return index;
  }

  async remove(botId: string, sessionId: string): Promise<IndexFile> {
    const index = await this.load(botId);
    delete index.sessions[sessionId];
    if (index.activeId === sessionId) {
      const next = Object.keys(index.sessions)[0] ?? null;
      index.activeId = next;
    }
    await this.save(botId, index);
    return index;
  }

  async dropFile(botId: string): Promise<void> {
    try {
      await unlink(this.fileFor(botId));
    } catch {
      // ignore
    }
  }
}
