/**
 * Store: Manages bots, state, and persistence
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import EventEmitter from 'node:events';
import type { Config } from '../config.js';
import { expandHome } from '../config.js';
import type {
  BotConfig,
  BotCreateRequest,
  BotUpdateRequest,
  SSEEvent,
} from '@pi-bot/shared';

import type { GroupConfig } from '../groups/types.js';

interface State {
  version: number;
  workspaceId: string;
  mainBotIds: string[];
  bots: Record<string, BotConfig>;
  groups: Record<string, GroupConfig>;
  schedules: unknown[]; // TODO
  secrets: Record<string, unknown>; // TODO
  revision: number;
}

export class Store extends EventEmitter {
  private state: State;
  private statePath: string;
  private config: Config;

  constructor(config: Config) {
    super();
    this.config = config;
    this.statePath = join(expandHome(config.host.home), 'state.json');
    this.state = {
      version: 1,
      workspaceId: randomUUID(),
      mainBotIds: [],
      bots: {},
      groups: {},
      schedules: [],
      secrets: {},
      revision: 0,
    };
  }

  async load() {
    try {
      const content = await readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(content) as State;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // State file doesn't exist, will be created on first save
    }
  }

  async save() {
    this.state.revision++;
    const tmpPath = `${this.statePath}.tmp`;

    await mkdir(join(expandHome(this.config.host.home)), { recursive: true });
    await writeFile(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8');

    // Atomic rename
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /**
   * Bootstrap: Create Chief bot if no bots exist
   */
  async bootstrap() {
    if (Object.keys(this.state.bots).length === 0) {
      console.log('First run: Creating Chief bot...');

      const chief = await this.createBot({
        name: 'Chief',
        role: 'Main assistant',
        instructions: 'You are the main bot. Help manage other bots and coordinate tasks.',
        model: {
          provider: this.config.pi.defaultModel ? 'custom' : 'deepseek',
          modelId: this.config.pi.defaultModel || 'deepseek-chat',
        },
        isMain: true,
      });

      console.log(`✓ Created Chief bot: ${chief.id}`);
    }
  }

  // ============================================================================
  // Bots
  // ============================================================================

  async listBots(): Promise<BotConfig[]> {
    return Object.values(this.state.bots);
  }

  async getBot(id: string): Promise<BotConfig | null> {
    return this.state.bots[id] ?? null;
  }

  async createBot(request: BotCreateRequest): Promise<BotConfig> {
    const id = `bot-${randomUUID().slice(0, 8)}`;

    const bot: BotConfig = {
      id,
      name: request.name,
      role: request.role,
      instructions: request.instructions,
      model: request.model,
      look: request.look,
      isMain: request.isMain ?? false,
      created: new Date().toISOString(),
      segments: [],
    };

    this.state.bots[id] = bot;

    if (bot.isMain) {
      this.state.mainBotIds.push(id);
    }

    await this.save();

    this.emit('bot_created', { type: 'bot_created', bot });

    return bot;
  }

  async updateBot(id: string, request: BotUpdateRequest): Promise<BotConfig> {
    const bot = this.state.bots[id];
    if (!bot) {
      throw new Error(`Bot not found: ${id}`);
    }

    if (request.name !== undefined) bot.name = request.name;
    if (request.role !== undefined) bot.role = request.role;
    if (request.instructions !== undefined) bot.instructions = request.instructions;
    if (request.model !== undefined) bot.model = request.model;
    if (request.look !== undefined) bot.look = request.look;

    await this.save();

    this.emit('bot_updated', { type: 'bot_updated', bot });

    return bot;
  }

  async deleteBot(id: string): Promise<void> {
    const bot = this.state.bots[id];
    if (!bot) {
      throw new Error(`Bot not found: ${id}`);
    }

    delete this.state.bots[id];

    // Remove from main bots list
    const mainIndex = this.state.mainBotIds.indexOf(id);
    if (mainIndex !== -1) {
      this.state.mainBotIds.splice(mainIndex, 1);
    }

    await this.save();

    this.emit('bot_deleted', { type: 'bot_deleted', id });
  }

  // ============================================================================
  // Sessions (placeholder)
  // ============================================================================

  async getActiveSessionCount(): Promise<number> {
    // TODO: Track active pi SDK sessions
    return 0;
  }

  // ============================================================================
  // Groups
  // ============================================================================

  async listGroups(): Promise<GroupConfig[]> {
    return Object.values(this.state.groups);
  }

  async getGroup(id: string): Promise<GroupConfig | null> {
    return this.state.groups[id] ?? null;
  }

  async createGroup(group: GroupConfig): Promise<GroupConfig> {
    this.state.groups[group.id] = group;
    await this.save();
    this.emit('group_created', { type: 'group_created', group });
    return group;
  }

  async updateGroup(id: string, updates: Partial<GroupConfig>): Promise<GroupConfig> {
    const group = this.state.groups[id];
    if (!group) {
      throw new Error(`Group not found: ${id}`);
    }

    Object.assign(group, updates);
    await this.save();
    this.emit('group_updated', { type: 'group_updated', group });
    return group;
  }

  async deleteGroup(id: string): Promise<void> {
    const group = this.state.groups[id];
    if (!group) {
      throw new Error(`Group not found: ${id}`);
    }

    delete this.state.groups[id];
    await this.save();
    this.emit('group_deleted', { type: 'group_deleted', id });
  }

  // ============================================================================
  // Events (type-safe wrapper)
  // ============================================================================

  override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  onAny(listener: (event: SSEEvent) => void): () => void {
    const handler = (payload: unknown) => listener(payload as SSEEvent);

    this.on('bot_created', handler);
    this.on('bot_updated', handler);
    this.on('bot_deleted', handler);
    this.on('group_created', handler);
    this.on('group_updated', handler);
    this.on('group_deleted', handler);

    return () => {
      this.off('bot_created', handler);
      this.off('bot_updated', handler);
      this.off('bot_deleted', handler);
      this.off('group_created', handler);
      this.off('group_updated', handler);
      this.off('group_deleted', handler);
    };
  }
}

export async function createStore(config: Config): Promise<Store> {
  const store = new Store(config);
  await store.load();
  return store;
}
