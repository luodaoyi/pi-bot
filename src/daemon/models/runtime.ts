/**
 * 复用 pi SDK 的 ModelRuntime / SettingsManager，路径跟随 PI_CODING_AGENT_DIR。
 */
import { join } from 'node:path';
import {
  getAgentDir,
  ModelRuntime,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';

let runtimePromise: Promise<ModelRuntime> | undefined;

export function getPiAgentDir(): string {
  return getAgentDir();
}

export function getPiAuthPath(): string {
  return join(getAgentDir(), 'auth.json');
}

export async function getModelRuntime(forceRefresh = false): Promise<ModelRuntime> {
  if (forceRefresh) {
    runtimePromise = undefined;
  }
  if (!runtimePromise) {
    const agentDir = getAgentDir();
    runtimePromise = ModelRuntime.create({
      authPath: join(agentDir, 'auth.json'),
      modelsPath: join(agentDir, 'models.json'),
      allowModelNetwork: false,
    });
  }
  return runtimePromise;
}

export function invalidateModelRuntime(): void {
  runtimePromise = undefined;
}

export function getPiSettingsManager(): SettingsManager {
  const agentDir = getAgentDir();
  return SettingsManager.create(agentDir, agentDir);
}
