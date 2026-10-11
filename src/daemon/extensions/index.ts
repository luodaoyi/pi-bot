/**
 * Pi extensions for scheduler, secrets, and usage tracking
 * 
 * This module provides a factory function that session pools can call
 * to create pi extensions with the necessary dependencies.
 */

import { createBashTool } from '@earendil-works/pi-coding-agent';
import type { Scheduler } from '../scheduler/index.js';
import type { SecretsManager } from '../secrets/index.js';
import type { UsageTracker } from '../usage/index.js';
import { createSchedulerExtension } from './scheduler.js';
import { createSecretsExtension } from './secrets.js';
import { createUsageExtension } from './usage.js';

export interface FeatureExtensionDependencies {
  scheduler: Scheduler;
  secrets: SecretsManager;
  usage: UsageTracker;
  getCurrentBotId: () => string;
  getSessionId: () => string;
  getCwd: () => string;
  /**
   * Get secrets for the current bot synchronously.
   * Session pool should cache secrets and refresh when they change.
   */
  getSecretsSync: () => Record<string, string>;
  onSecretRequest?: (name: string, purpose: string, botId: string) => void;
}

export interface FeatureExtensionsResult {
  /**
   * Extension factories to pass to pi session creation.
   * Use these when creating AgentSession instances.
   */
  extensions: Array<(pi: any) => void | { bashSpawnHook?: any }>;

  /**
   * Enhanced bash tool with secret injection.
   * Replace the default bash tool with this one.
   */
  createBashToolWithSecrets: (cwd: string) => ReturnType<typeof createBashTool>;
}

/**
 * Create pi extensions for scheduler, secrets, and usage tracking.
 * 
 * @example
 * ```ts
 * const features = createFeatureExtensions({
 *   scheduler,
 *   secrets,
 *   usage,
 *   getCurrentBotId: () => currentBot.id,
 *   getSessionId: () => session.id,
 *   getCwd: () => process.cwd(),
 *   getSecretsSync: () => cachedSecrets,
 *   onSecretRequest: (name, purpose, botId) => {
 *     // Show approval UI
 *   },
 * });
 * 
 * // When creating a pi session:
 * const { session } = await createAgentSession({
 *   extensionFactories: features.extensions,
 *   // Replace default bash tool
 *   tools: [
 *     features.createBashToolWithSecrets(cwd),
 *     // ... other tools
 *   ],
 * });
 * ```
 */
export function createFeatureExtensions(
  deps: FeatureExtensionDependencies
): FeatureExtensionsResult {
  const schedulerExt = createSchedulerExtension({
    scheduler: deps.scheduler,
    getCurrentBotId: deps.getCurrentBotId,
  });

  const secretsExtResult = createSecretsExtension({
    secrets: deps.secrets,
    getCurrentBotId: deps.getCurrentBotId,
    getSecretsSync: deps.getSecretsSync,
    onSecretRequest: deps.onSecretRequest,
  });

  const usageExt = createUsageExtension({
    usage: deps.usage,
    getCurrentBotId: deps.getCurrentBotId,
    getSessionId: deps.getSessionId,
  });

  // Collect extensions
  const extensions: Array<(pi: any) => void | { bashSpawnHook?: any }> = [
    schedulerExt,
    secretsExtResult,
    usageExt,
  ];

  // Create bash tool factory with secret injection
  const createBashToolWithSecrets = (cwd: string) => {
    // Get the spawnHook from secrets extension
    const secretsResult = secretsExtResult({} as any);
    const spawnHook = typeof secretsResult === 'object' && secretsResult.bashSpawnHook
      ? secretsResult.bashSpawnHook
      : undefined;

    return createBashTool(cwd, { spawnHook });
  };

  return {
    extensions,
    createBashToolWithSecrets,
  };
}

// Re-export extension factories for advanced use cases
export { createSchedulerExtension } from './scheduler.js';
export { createSecretsExtension } from './secrets.js';
export { createUsageExtension } from './usage.js';
