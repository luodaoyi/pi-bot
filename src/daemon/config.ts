/**
 * Configuration management for pi-bot daemon
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

// Zod schema for configuration
const ConfigSchema = z.object({
  host: z.object({
    home: z.string().default('~/.pi-bot'),
    listen: z.string().default('127.0.0.1:8787'),
    workspace: z.string().default('~/.pi-bot/workspace'),
    maxSessions: z.number().default(16),
    idleSeconds: z.number().default(600),
  }),
  
  pi: z.object({
    minVersion: z.string().default('1.1.0'),
    loadUserExtensions: z.boolean().default(false),
    loadContextFiles: z.boolean().default(false),
    defaultModel: z.string().default(''),
  }),
  
  memory: z.object({
    backend: z.enum(['respire', 'markdown', 'off']).default('respire'),
    review: z.boolean().default(false),
  }),
  
  respire: z.object({
    port: z.number().default(15169),
    autostart: z.boolean().default(true),
    policy: z.enum(['full', 'lite']).default('full'),
    reanchorTokens: z.number().default(60000),
    gate: z.object({
      firstTool: z.enum(['block', 'warn', 'off']).default('block'),
      strictBatch: z.boolean().default(true),
      errorGate: z.enum(['block', 'warn', 'off']).default('block'),
      settleRecall: z.enum(['continue', 'warn', 'off']).default('continue'),
      settleStore: z.enum(['warn', 'off']).default('warn'),
      forceToolChoice: z.boolean().default(false),
      maxBlocks: z.number().default(3),
    }),
    scope: z.object({
      teamProject: z.string().default(''),
      botProjectPrefix: z.string().default('pi-bot/'),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: Config = {
  host: {
    home: '~/.pi-bot',
    listen: '127.0.0.1:8787',
    workspace: '~/.pi-bot/workspace',
    maxSessions: 16,
    idleSeconds: 600,
  },
  pi: {
    minVersion: '1.1.0',
    loadUserExtensions: false,
    loadContextFiles: false,
    defaultModel: '',
  },
  memory: {
    backend: 'respire',
    review: false,
  },
  respire: {
    port: Number(process.env['RSRS_RPC_PORT']) || 15169,
    autostart: true,
    policy: 'full',
    reanchorTokens: 60000,
    gate: {
      firstTool: 'block',
      strictBatch: true,
      errorGate: 'block',
      settleRecall: 'continue',
      settleStore: 'warn',
      forceToolChoice: false,
      maxBlocks: 3,
    },
    scope: {
      teamProject: '',
      botProjectPrefix: 'pi-bot/',
    },
  },
};

/**
 * Load configuration from file or use defaults
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  const envHome = process.env['PI_BOT_HOME'];
  const defaultHome = envHome || join(homedir(), '.pi-bot');
  const path = configPath ?? join(defaultHome, 'config.toml');

  const envPort = Number(process.env['RSRS_RPC_PORT']);
  const base: Config = {
    ...DEFAULT_CONFIG,
    host: {
      ...DEFAULT_CONFIG.host,
      home: defaultHome,
      workspace: envHome ? join(envHome, 'workspace') : DEFAULT_CONFIG.host.workspace,
    },
    respire: {
      ...DEFAULT_CONFIG.respire,
      port: Number.isFinite(envPort) && envPort > 0 ? envPort : DEFAULT_CONFIG.respire.port,
    },
  };

  try {
    await readFile(path, 'utf-8');
    // TODO: Parse TOML (for now, just use defaults)
    console.log(`Loaded config from: ${path}`);
    return ConfigSchema.parse(base);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No config file found, using defaults');
      return ConfigSchema.parse(base);
    }
    throw error;
  }
}

/**
 * Expand ~ in paths
 */
export function expandHome(path: string): string {
  const envHome = process.env['PI_BOT_HOME'];
  if (envHome && (path === '~/.pi-bot' || path.startsWith('~/.pi-bot/'))) {
    return path.replace('~/.pi-bot', envHome);
  }
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}
