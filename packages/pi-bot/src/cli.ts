#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("pi-bot")
  .description("Multi-bot team daemon for pi coding agent")
  .version("0.1.0");

program
  .command("serve")
  .description("Start the daemon server")
  .option("-p, --port <port>", "HTTP port", "8787")
  .option("-h, --host <host>", "HTTP host", "127.0.0.1")
  .action(async (options) => {
    const { getHomeLayout } = await import("./home.js");
    const { loadState, bootstrap, saveState } = await import("./store.js");
    const { Daemon } = await import("./daemon.js");
    const { serve } = await import("./server/index.js");
    
    const home = getHomeLayout();
    const state = await loadState(home.state);
    
    const chief = await bootstrap(state);
    await saveState(home.state, state);
    
    console.log(`Chief bot: ${chief.name} (${chief.id})`);
    
    const daemon = new Daemon({
      state,
      statePath: home.state,
      secretsPath: home.secrets,
      usagePath: home.usage,
    });
    
    await daemon.init();
    
    await serve({
      port: Number(options.port),
      host: options.host,
      daemon,
    });
  });

program
  .command("init")
  .description("Initialize pi-bot home directory and config")
  .action(async () => {
    const { init } = await import("./home.js");
    await init();
  });

program
  .command("doctor")
  .description("Diagnose setup and configuration")
  .action(async () => {
    const { doctor } = await import("./doctor.js");
    await doctor();
  });

program.parse();
