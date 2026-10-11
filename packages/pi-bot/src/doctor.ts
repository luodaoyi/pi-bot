export async function doctor(): Promise<void> {
  console.log("pi-bot Doctor\n");

  const checks = [
    { name: "Node version", check: checkNode },
    { name: "Home directory", check: checkHome },
    { name: "Respire runtime", check: checkRespire },
    { name: "pi SDK", check: checkPi },
  ];

  for (const { name, check } of checks) {
    try {
      const result = await check();
      console.log(`✓ ${name}: ${result}`);
    } catch (error) {
      console.log(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function checkNode(): Promise<string> {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split(".")[0] ?? "0");
  
  if (major < 22) {
    throw new Error(`Node ${version} < 22.19 (required)`);
  }
  
  return `${version} (OK)`;
}

async function checkHome(): Promise<string> {
  const { getHomeLayout } = await import("./home.js");
  const { access } = await import("node:fs/promises");
  const { constants } = await import("node:fs");
  
  const home = getHomeLayout();
  
  try {
    await access(home.root, constants.R_OK | constants.W_OK);
    await access(home.state);
    return `${home.root} (exists)`;
  } catch {
    throw new Error(`${home.root} not initialized (run: pi-bot init)`);
  }
}

async function checkRespire(): Promise<string> {
  const { RespireClient } = await import("@pi-bot/respire-client");
  const client = new RespireClient();
  
  try {
    const health = await client.health();
    return `${health.bin} (${health.url})`;
  } catch (error) {
    throw new Error("Runtime unavailable (run: rsrs --json status)");
  }
}

async function checkPi(): Promise<string> {
  try {
    await import("@earendil-works/pi-coding-agent");
    return "SDK found";
  } catch {
    throw new Error("pi SDK not found (install: npm i -g @earendil-works/pi-coding-agent)");
  }
}
