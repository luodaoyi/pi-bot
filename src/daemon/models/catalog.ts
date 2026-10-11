/**
 * 从 pi SDK 模型目录（built-ins + models.json）列出模型，不做硬编码。
 */
import { getModelRuntime, getPiSettingsManager } from './runtime.js';

export interface CatalogModel {
  provider: string;
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  input: string[];
  hasAuth: boolean;
}

export interface CatalogResponse {
  models: CatalogModel[];
  defaultModel: { provider: string; id: string } | null;
  defaultThinking: string | null;
}

export async function listCatalog(): Promise<CatalogResponse> {
  const runtime = await getModelRuntime();
  const settings = getPiSettingsManager();

  const models: CatalogModel[] = runtime.getModels().map((model) => ({
    provider: String(model.provider),
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    reasoning: Boolean(model.reasoning),
    input: Array.isArray(model.input) ? [...model.input] : ['text'],
    hasAuth: runtime.hasConfiguredAuth(String(model.provider)),
  }));

  const defaultProvider = settings.getDefaultProvider();
  const defaultModelId = settings.getDefaultModel();
  const defaultModel =
    defaultProvider && defaultModelId
      ? { provider: defaultProvider, id: defaultModelId }
      : null;

  return {
    models,
    defaultModel,
    defaultThinking: settings.getDefaultThinkingLevel() ?? null,
  };
}
