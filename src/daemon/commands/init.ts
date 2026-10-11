/**
 * Initialize pi-bot configuration
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export async function init() {
  const home = join(homedir(), '.pi-bot');

  console.log('Initializing pi-bot...');
  console.log(`Home directory: ${home}`);

  // Create directories
  await mkdir(home, { recursive: true });
  await mkdir(join(home, 'workspace'), { recursive: true });
  await mkdir(join(home, 'sessions'), { recursive: true });

  // Create default config
  const configPath = join(home, 'config.toml');
  const configContent = `# pi-bot configuration

[host]
home = "~/.pi-bot"
listen = "127.0.0.1:8787"
workspace = "~/.pi-bot/workspace"
max_sessions = 16
idle_seconds = 600

[pi]
min_version = "1.1.0"
load_user_extensions = false
load_context_files = false
default_model = ""

[memory]
backend = "respire"
review = false

[respire]
port = 15169
autostart = true
policy = "full"
reanchor_tokens = 60000

[respire.gate]
first_tool = "block"
strict_batch = true
error_gate = "block"
settle_recall = "continue"
settle_store = "warn"
force_tool_choice = false
max_blocks = 3

[respire.scope]
team_project = ""
bot_project_prefix = "pi-bot/"
`;

  await writeFile(configPath, configContent, 'utf-8');

  console.log(`✓ Created config: ${configPath}`);
  console.log('✓ Created workspace directories');
  console.log('\nNext steps:');
  console.log('  1. Start the daemon: pi-bot serve');
  console.log('  2. Open http://localhost:8787 in your browser');
  console.log('  3. Create your first bot!');
}
