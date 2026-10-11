/**
 * Provider 列表与凭据写入。凭据只写 pi 的 auth.json，经 SDK AuthStorage 加锁，
 * 绝不把 key 打到日志或响应里。
 */
import { randomUUID } from 'node:crypto';
import type { AuthEvent, Credential } from '@earendil-works/pi-ai';
import { createAuthStorage } from './auth-storage.js';
import { getModelRuntime, getPiAuthPath, invalidateModelRuntime } from './runtime.js';

export type ProviderAuthType = 'apiKey' | 'oauth' | 'both';
export type ProviderAuthSource = 'auth.json' | 'env' | null;

export interface ProviderListing {
  id: string;
  name: string;
  authType: ProviderAuthType;
  configured: boolean;
  source: ProviderAuthSource;
}

export class ProviderHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function mapAuthSource(source: string | undefined): ProviderAuthSource {
  if (source === 'environment') return 'env';
  if (
    source === 'stored' ||
    source === 'runtime' ||
    source === 'fallback' ||
    source === 'models_json_key' ||
    source === 'models_json_command'
  ) {
    return 'auth.json';
  }
  return null;
}

function authTypeOf(hasApiKey: boolean, hasOAuth: boolean): ProviderAuthType {
  if (hasApiKey && hasOAuth) return 'both';
  if (hasOAuth) return 'oauth';
  return 'apiKey';
}

export async function listProviders(): Promise<ProviderListing[]> {
  const runtime = await getModelRuntime();
  return runtime.getProviders().map((provider) => {
    const status = runtime.getProviderAuthStatus(provider.id);
    return {
      id: provider.id,
      name: provider.name,
      authType: authTypeOf(Boolean(provider.auth.apiKey), Boolean(provider.auth.oauth)),
      configured: status.configured || runtime.hasConfiguredAuth(provider.id),
      source: status.configured ? mapAuthSource(status.source) : null,
    };
  });
}

export async function storeApiKey(providerId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new ProviderHttpError(400, 'apiKey is required');
  }

  const runtime = await getModelRuntime();
  const provider = runtime.getProvider(providerId);
  if (!provider) {
    throw new ProviderHttpError(404, `Unknown provider: ${providerId}`);
  }
  if (!provider.auth.apiKey) {
    throw new ProviderHttpError(400, `Provider ${providerId} does not accept API keys`);
  }

  const credential: Credential = { type: 'api_key', key: trimmed };
  try {
    const storage = await createAuthStorage(getPiAuthPath());
    await storage.modify(providerId, async () => credential);
  } catch {
    await persistApiKeyViaLogin(providerId, trimmed);
  }
  invalidateModelRuntime();
}

async function persistApiKeyViaLogin(providerId: string, apiKey: string): Promise<void> {
  const runtime = await getModelRuntime();
  let submitted = false;
  await runtime.login(providerId, 'api_key', {
    prompt: async (prompt) => {
      if (prompt.type === 'select') {
        const option = prompt.options.find((item) => item.id === 'api-key' || item.id === 'bearer-token');
        return option?.id ?? prompt.options[0]?.id ?? 'api-key';
      }
      if ((prompt.type === 'secret' || prompt.type === 'text') && !submitted) {
        submitted = true;
        return apiKey;
      }
      throw new Error(`Provider ${providerId} requires interactive API key setup`);
    },
    notify: () => {},
  });
}

export async function deleteProviderAuth(providerId: string): Promise<boolean> {
  try {
    const storage = await createAuthStorage(getPiAuthPath());
    const existing = await storage.read(providerId);
    await storage.delete(providerId);
    invalidateModelRuntime();
    return Boolean(existing);
  } catch {
    const runtime = await getModelRuntime();
    const existed = runtime.hasConfiguredAuth(providerId);
    await runtime.logout(providerId);
    invalidateModelRuntime();
    return existed;
  }
}

interface OAuthFlow {
  providerId: string;
  status: 'pending' | 'done' | 'error';
  url?: string;
  error?: string;
  abort: AbortController;
  startedAt: number;
}

const oauthFlows = new Map<string, OAuthFlow>();
const FLOW_TTL_MS = 10 * 60 * 1000;

function sweepFlows(): void {
  const now = Date.now();
  for (const [id, flow] of oauthFlows) {
    if (now - flow.startedAt > FLOW_TTL_MS) {
      flow.abort.abort();
      oauthFlows.delete(id);
    }
  }
}

export async function startOAuth(providerId: string): Promise<{ url: string; flowId: string }> {
  sweepFlows();
  const runtime = await getModelRuntime();
  const provider = runtime.getProvider(providerId);
  if (!provider) {
    throw new ProviderHttpError(404, `Unknown provider: ${providerId}`);
  }
  if (!provider.auth.oauth?.login) {
    throw new ProviderHttpError(
      501,
      `Provider ${providerId} does not expose an OAuth login flow. Use PUT /api/providers/${providerId}/api-key or run \`pi /login\` in the terminal.`
    );
  }

  const flowId = randomUUID();
  const abort = new AbortController();
  const flow: OAuthFlow = {
    providerId,
    status: 'pending',
    abort,
    startedAt: Date.now(),
  };
  oauthFlows.set(flowId, flow);

  const urlReady = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const timer = setTimeout(finish, 12_000);

    void runtime
      .login(
        providerId,
        'oauth',
        {
          signal: abort.signal,
          prompt: async () => {
            throw new Error(
              'Interactive OAuth prompts are not supported in the daemon. Complete login in the browser or run `pi /login`.'
            );
          },
          notify: (event: AuthEvent) => {
            if (event.type === 'auth_url' && event.url) {
              flow.url = event.url;
              finish();
            } else if (event.type === 'device_code' && event.verificationUri) {
              flow.url = event.verificationUri;
              finish();
            }
          },
        }
      )
      .then(() => {
        flow.status = 'done';
        invalidateModelRuntime();
        finish();
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        flow.status = 'error';
        flow.error = error instanceof Error ? error.message : String(error);
        finish();
      })
      .finally(() => {
        clearTimeout(timer);
      });
  });

  await urlReady;

  if (!flow.url) {
    abort.abort();
    oauthFlows.delete(flowId);
    throw new ProviderHttpError(
      501,
      flow.error ??
        `OAuth login for ${providerId} did not produce an authorization URL. Complete login with \`pi /login\` in the terminal.`
    );
  }

  return { url: flow.url, flowId };
}

export function pollOAuth(
  providerId: string,
  flowId: string
): { status: 'pending' | 'done' | 'error'; error?: string } {
  sweepFlows();
  const flow = oauthFlows.get(flowId);
  if (!flow || flow.providerId !== providerId) {
    throw new ProviderHttpError(404, 'OAuth flow not found');
  }
  return {
    status: flow.status,
    ...(flow.error ? { error: flow.error } : {}),
  };
}

/** 仅测试用：清掉进行中的 OAuth 流程 */
export function resetOAuthFlowsForTests(): void {
  for (const flow of oauthFlows.values()) {
    flow.abort.abort();
  }
  oauthFlows.clear();
}
