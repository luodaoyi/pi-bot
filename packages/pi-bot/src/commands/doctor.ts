/**
 * Health check for pi-bot system
 */

import { RespireClient } from '@pi-bot/respire-client';

export async function doctor() {
  console.log('pi-bot System Check\n');

  // Check Node version
  const nodeVersion = process.version;
  const [major] = nodeVersion.slice(1).split('.').map(Number);
  const nodeOk = (major ?? 0) >= 22;

  console.log(`✓ Node.js: ${nodeVersion} ${nodeOk ? '(OK)' : '(Need >= 22.19)'}`);

  // Check Respire
  console.log('\nChecking Respire...');
  const client = new RespireClient({ autostart: false });

  try {
    const health = await client.health();
    console.log(`✓ Respire: ${health.bin} (running on port ${health.url})`);

    const config = await client.agentConfig();
    const mode = config.memory_off ? 'off' : config.readonly ? 'readonly' : 'normal';
    console.log(`✓ Memory mode: ${mode}`);
  } catch (error) {
    console.log(`✗ Respire: Not available`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  Install: npm install -g rsrs-cli`);
  }

  // Check pi coding agent
  console.log('\nChecking pi...');
  try {
    // Try to import pi
    await import('@earendil-works/pi-coding-agent');
    console.log(`✓ pi coding agent: installed`);
  } catch {
    console.log(`✗ pi coding agent: Not found`);
    console.log(`  This is a peer dependency`);
    console.log(`  Install: npm install -g @earendil-works/pi-coding-agent`);
  }

  console.log('\nSystem check complete!');
}
