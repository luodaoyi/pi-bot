/**
 * Shared pi SDK services for the daemon.
 *
 * Created once per process so package resolution / ModelRuntime / SettingsManager
 * are not repeated for every bot session.
 */

import {
  createAgentSessionServices,
  getAgentDir,
  type AgentSessionServices,
  type ModelRuntime,
} from '@earendil-works/pi-coding-agent';
import { getModelRuntime } from '../models/runtime.js';

export interface SharedServicesOptions {
  cwd: string;
  loadUserExtensions: boolean;
  loadContextFiles: boolean;
  agentDir?: string;
  modelRuntime?: ModelRuntime;
}

let shared: AgentSessionServices | undefined;
let sharedKey: string | undefined;

function cacheKey(options: SharedServicesOptions): string {
  return [
    options.cwd,
    options.agentDir ?? '',
    options.loadUserExtensions ? '1' : '0',
    options.loadContextFiles ? '1' : '0',
  ].join('|');
}

/**
 * Create (or reuse) daemon-wide AgentSessionServices.
 * Pass a prebuilt ModelRuntime in tests (e.g. faux provider).
 */
export async function getSharedAgentServices(
  options: SharedServicesOptions
): Promise<AgentSessionServices> {
  const injectedRuntime = options.modelRuntime;
  // Production uses C's singleton so catalog / providers / sessions share one runtime.
  const modelRuntime = injectedRuntime ?? (await getModelRuntime());
  const key = cacheKey(options);

  if (
    shared &&
    sharedKey === key &&
    !injectedRuntime &&
    shared.modelRuntime === modelRuntime
  ) {
    return shared;
  }

  const services = await createAgentSessionServices({
    cwd: options.cwd,
    agentDir: options.agentDir ?? getAgentDir(),
    modelRuntime,
    resourceLoaderOptions: {
      noExtensions: !options.loadUserExtensions,
      noContextFiles: !options.loadContextFiles,
    },
  });

  if (!injectedRuntime) {
    shared = services;
    sharedKey = key;
  }

  return services;
}

/** Test helper: drop the process-wide cache. */
export function resetSharedAgentServices(): void {
  shared = undefined;
  sharedKey = undefined;
}

/** Bind shared services to a bot workdir without reloading packages. */
export function servicesForCwd(
  services: AgentSessionServices,
  cwd: string
): AgentSessionServices {
  if (services.cwd === cwd) return services;
  return { ...services, cwd };
}
