import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { api, ApiError } from '@/api';
import type { Settings } from '@/types';
import type { ModelRef, PiModel, ProviderInfo, ThinkingLevel } from '@/api/types';
import { PageStatus } from '@/components/PageStatus';
import { ModelPicker } from '@/components/models/ModelPicker';
import { ThinkingSelector } from '@/components/models/ThinkingSelector';
import { isNotImplemented, normalizeSettings } from '@/api/normalize';

type TabId = 'general' | 'models' | 'providers' | 'sessions' | 'memory';

export const SettingsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabId) || 'general';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<PiModel[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      setSettings(normalizeSettings(data));
      try {
        const catalog = await api.getModels();
        setModels(catalog.models);
      } catch {
        setModels([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    setProviderError(null);
    try {
      setProviders(await api.getProviders());
    } catch (err) {
      if (isNotImplemented(err)) {
        setProviders([]);
        setProviderError(t('settings.providersUnavailable'));
        return;
      }
      setProviderError(err instanceof Error ? err.message : t('common.loadFailed'));
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (tab === 'providers') void loadProviders();
  }, [tab]);

  const tabs = useMemo(() => ([
    { id: 'general' as const, label: t('settings.tabGeneral') },
    { id: 'models' as const, label: t('settings.tabModels') },
    { id: 'providers' as const, label: t('settings.tabProviders') },
    { id: 'sessions' as const, label: t('settings.tabSessions') },
    { id: 'memory' as const, label: t('settings.tabMemory') },
  ]), [t]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(normalizeSettings(updated));
      await i18n.changeLanguage(updated.language);
      const root = document.documentElement;
      if (updated.theme === 'dark') root.classList.add('dark');
      else if (updated.theme === 'light') root.classList.remove('dark');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <SettingsIcon className="text-blue-600" size={32} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`settings-tab-${item.id}`}
              onClick={() => setParams({ tab: item.id })}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                tab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <PageStatus loading={loading} error={error} onRetry={() => void loadSettings()}>
          {settings && (
            <div className="max-w-2xl space-y-6">
              {tab === 'general' && (
                <>
                  <Field label={t('settings.language')}>
                    <select
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value as Settings['language'] })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="zh-CN">简体中文</option>
                      <option value="en-US">English</option>
                    </select>
                  </Field>
                  <Field label={t('settings.theme')}>
                    <select
                      value={settings.theme}
                      onChange={(e) => setSettings({ ...settings, theme: e.target.value as Settings['theme'] })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="light">{t('settings.themeLight')}</option>
                      <option value="dark">{t('settings.themeDark')}</option>
                      <option value="auto">{t('settings.themeAuto')}</option>
                    </select>
                  </Field>
                  <Field label={t('settings.timezone')}>
                    <input
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    />
                  </Field>
                  <Field label={t('settings.workdir')}>
                    <input
                      value={settings.workdir}
                      onChange={(e) => setSettings({ ...settings, workdir: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    />
                  </Field>
                </>
              )}

              {tab === 'models' && (
                <>
                  <Field label={t('settings.defaultModel')}>
                    <ModelPicker
                      models={models}
                      value={settings.defaultModel}
                      onChange={(model: ModelRef | null) => setSettings({ ...settings, defaultModel: model })}
                      testId="settings-default-model"
                    />
                  </Field>
                  <Field label={t('settings.defaultThinking')}>
                    <ThinkingSelector
                      value={settings.defaultThinking}
                      onChange={(value: ThinkingLevel | null) => setSettings({ ...settings, defaultThinking: value })}
                    />
                  </Field>
                </>
              )}

              {tab === 'providers' && (
                <ProvidersPanel
                  providers={providers}
                  error={providerError}
                  onReload={() => void loadProviders()}
                />
              )}

              {tab === 'sessions' && (
                <>
                  <Field label={t('settings.maxSessions')}>
                    <input
                      type="number"
                      value={settings.maxSessions}
                      onChange={(e) => setSettings({ ...settings, maxSessions: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                      min="1"
                      max="64"
                    />
                  </Field>
                  <Field label={t('settings.idleTimeout')}>
                    <input
                      type="number"
                      value={settings.idleTimeoutMinutes}
                      onChange={(e) => setSettings({ ...settings, idleTimeoutMinutes: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                      min="1"
                    />
                  </Field>
                  <label className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <input
                      type="checkbox"
                      checked={settings.loadUserExtensions}
                      onChange={(e) => setSettings({ ...settings, loadUserExtensions: e.target.checked })}
                    />
                    <span>{t('settings.loadUserExtensions')}</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <input
                      type="checkbox"
                      checked={settings.loadContextFiles}
                      onChange={(e) => setSettings({ ...settings, loadContextFiles: e.target.checked })}
                    />
                    <span>{t('settings.loadContextFiles')}</span>
                  </label>
                </>
              )}

              {tab === 'memory' && (
                <>
                  <Field label={t('settings.memoryBackend')}>
                    <select
                      value={settings.memoryBackend}
                      onChange={(e) => setSettings({ ...settings, memoryBackend: e.target.value as Settings['memoryBackend'] })}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="respire">{t('settings.memoryBackendRespire')}</option>
                      <option value="markdown">{t('settings.memoryBackendMarkdown')}</option>
                      <option value="off">{t('settings.memoryBackendOff')}</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.memoryReview)}
                      onChange={(e) => setSettings({ ...settings, memoryReview: e.target.checked })}
                    />
                    <span>{t('settings.memoryReview')}</span>
                  </label>
                </>
              )}

              {saveError && <p className="text-red-600">{saveError}</p>}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          )}
        </PageStatus>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</label>
    {children}
  </div>
);

const ProvidersPanel: React.FC<{
  providers: ProviderInfo[];
  error: string | null;
  onReload: () => void;
}> = ({ providers, error, onReload }) => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (error && providers.length === 0) {
    return <PageStatus loading={false} error={error} onRetry={onReload} empty={false} />;
  }

  if (providers.length === 0) {
    return <div data-state="empty" className="text-gray-500">{t('settings.providersEmpty')}</div>;
  }

  return (
    <div className="space-y-3" data-testid="providers-panel">
      {localError && <p className="text-red-600 text-sm">{localError}</p>}
      {providers.map((provider) => (
        <div key={provider.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg border space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium">{provider.name}</div>
              <div className="text-xs text-gray-400">
                {provider.configured ? t('settings.configured', { source: provider.source ?? '' }) : t('settings.notConfigured')}
              </div>
            </div>
            {provider.configured && (
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => {
                  setBusy(provider.id);
                  void api.deleteProviderAuth(provider.id)
                    .then(onReload)
                    .catch((err) => setLocalError(err instanceof Error ? err.message : t('common.error')))
                    .finally(() => setBusy(null));
                }}
              >
                {t('settings.deleteKey')}
              </button>
            )}
          </div>
          {(provider.authType === 'apiKey' || provider.authType === 'both') && (
            <div className="flex gap-2">
              <input
                type="password"
                data-testid={`provider-key-${provider.id}`}
                placeholder={t('settings.apiKeyPlaceholder')}
                value={keys[provider.id] ?? ''}
                onChange={(e) => setKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
              />
              <button
                type="button"
                disabled={busy === provider.id}
                onClick={() => {
                  setBusy(provider.id);
                  void api.setProviderApiKey(provider.id, keys[provider.id] ?? '')
                    .then(() => {
                      setKeys((prev) => ({ ...prev, [provider.id]: '' }));
                      onReload();
                    })
                    .catch((err) => {
                      const message = err instanceof ApiError ? err.message : t('common.error');
                      setLocalError(message);
                    })
                    .finally(() => setBusy(null));
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg"
              >
                {t('common.save')}
              </button>
            </div>
          )}
          {(provider.authType === 'oauth' || provider.authType === 'both') && (
            <button
              type="button"
              data-testid={`provider-oauth-${provider.id}`}
              className="px-3 py-2 border rounded-lg"
              onClick={() => {
                setBusy(provider.id);
                void api.startProviderOAuth(provider.id)
                  .then((start) => {
                    window.open(start.url, '_blank', 'noopener');
                  })
                  .catch((err) => setLocalError(err instanceof Error ? err.message : t('common.error')))
                  .finally(() => setBusy(null));
              }}
            >
              {t('settings.oauth')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
