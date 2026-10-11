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

function fauxEnabled(): boolean {
  return process.env['PI_BOT_FAUX'] === '1' || process.env['PI_BOT_E2E_FAUX'] === '1';
}

/** 仅测试/冒烟：注册 pi-ai faux 提供商，每次对话回一段可流式文本。 */
async function attachFauxProvider(runtime: ModelRuntime): Promise<void> {
  if (!fauxEnabled()) return;
  try {
    const { fauxAssistantMessage, fauxProvider, fauxText, fauxThinking } = await import('@earendil-works/pi-ai');
    const handle = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-1', name: 'Faux One', reasoning: true }],
      tokensPerSecond: 60,
    });
    const enqueueEcho = () => {
      handle.appendResponses([() => {
        enqueueEcho();
        return fauxAssistantMessage([
          fauxThinking('considering'),
          fauxText('hello from faux stream'),
        ]);
      }]);
    };
    enqueueEcho();
    runtime.registerNativeProvider(handle.provider);
    try {
      await runtime.setRuntimeApiKey(handle.provider.id, 'test-key');
    } catch {
      // 部分 faux 没有 apiKey login；catalog 仍会列出模型
    }
  } catch (error) {
    console.warn(
      '[pi-bot] PI_BOT_FAUX set but faux provider failed to load:',
      error instanceof Error ? error.message : error
    );
  }
}

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
    }).then(async (runtime) => {
      await attachFauxProvider(runtime);
      return runtime;
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
