import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";

export interface HomeLayout {
  root: string;
  state: string;
  lock: string;
  secrets: string;
  usage: string;
  chatIndex: string;
}

export function getHomeLayout(customRoot?: string): HomeLayout {
  const root = customRoot ?? process.env.PIBOT_HOME ?? join(homedir(), ".pi-bot");
  
  return {
    root,
    state: join(root, "state.json"),
    lock: join(root, "state.lock"),
    secrets: join(root, "secrets.json"),
    usage: join(root, "usage.sqlite"),
    chatIndex: join(root, "chat-index.sqlite"),
  };
}

export async function ensureHome(layout?: HomeLayout): Promise<HomeLayout> {
  const home = layout ?? getHomeLayout();
  
  try {
    await access(home.root, constants.R_OK | constants.W_OK);
  } catch {
    await mkdir(home.root, { recursive: true, mode: 0o700 });
  }

  return home;
}

export async function init(): Promise<void> {
  const home = await ensureHome();
  
  const initialState = {
    version: 1,
    bots: {},
    groups: {},
    questions: [],
    schedules: [],
    revision: 0,
  };

  try {
    await access(home.state);
    console.log(`Home already initialized at ${home.root}`);
  } catch {
    await writeFile(home.state, JSON.stringify(initialState, null, 2));
    console.log(`Initialized pi-bot home at ${home.root}`);
  }

  try {
    await access(home.secrets);
  } catch {
    await writeFile(home.secrets, JSON.stringify({ secrets: [] }, null, 2), { mode: 0o600 });
    console.log(`Created secrets file at ${home.secrets}`);
  }

  console.log("\nNext steps:");
  console.log("  pi-bot serve    # Start the daemon");
  console.log("  pi-bot doctor   # Check setup");
}
