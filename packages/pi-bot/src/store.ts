import type { Bot } from "@pi-bot/protocol";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export interface State {
  version: number;
  bots: Record<string, Bot>;
  groups: Record<string, any>;
  questions: any[];
  schedules: any[];
  revision: number;
}

export async function loadState(path: string): Promise<State> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as State;
}

export async function saveState(path: string, state: State): Promise<void> {
  const tmpPath = `${path}.tmp`;
  const content = JSON.stringify({ ...state, revision: state.revision + 1 }, null, 2);
  await writeFile(tmpPath, content);
  await writeFile(path, content);
}

export async function bootstrap(state: State): Promise<Bot> {
  if (Object.keys(state.bots).length > 0) {
    const existing = Object.values(state.bots).find((b) => b.main);
    if (existing) return existing;
  }

  const chief: Bot = {
    id: randomUUID(),
    name: "Chief",
    role: "Main bot and team coordinator",
    instructions: "You are the main bot. You can create and manage other bots in the team.",
    model: "deepseek/deepseek-chat",
    main: true,
    created: Date.now(),
    sessions: [],
  };

  state.bots[chief.id] = chief;
  
  return chief;
}

export function createBot(state: State, spec: Partial<Bot>): Bot {
  const bot: Bot = {
    id: randomUUID(),
    name: spec.name ?? "Unnamed Bot",
    role: spec.role ?? "Assistant",
    instructions: spec.instructions ?? "",
    model: spec.model ?? "deepseek/deepseek-chat",
    color: spec.color,
    avatar: spec.avatar,
    main: spec.main ?? false,
    created: Date.now(),
    sessions: [],
  };

  state.bots[bot.id] = bot;
  
  return bot;
}

export function listBots(state: State): Bot[] {
  return Object.values(state.bots).sort((a, b) => {
    if (a.main && !b.main) return -1;
    if (!a.main && b.main) return 1;
    return a.created - b.created;
  });
}

export function getBot(state: State, id: string): Bot | undefined {
  return state.bots[id];
}

export function updateBot(state: State, id: string, updates: Partial<Bot>): Bot | undefined {
  const bot = state.bots[id];
  if (!bot) return undefined;

  Object.assign(bot, updates);
  return bot;
}

export function deleteBot(state: State, id: string): boolean {
  if (!state.bots[id]) return false;
  delete state.bots[id];
  return true;
}
