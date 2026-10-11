import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon } from 'lucide-react';
import { api } from '@/api';
import type { Settings } from '@/types';
import { PageStatus } from '@/components/PageStatus';

export const SettingsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
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

  useEffect(() => {
    void loadSettings();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <SettingsIcon className="text-blue-600" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('settings.title')}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <PageStatus loading={loading} error={error} onRetry={() => void loadSettings()}>
          {settings && (
            <div className="max-w-2xl space-y-6">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('settings.language')}
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value as Settings['language'] })}
                  className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('settings.theme')}
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value as Settings['theme'] })}
                  className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="light">{t('settings.themeLight')}</option>
                  <option value="dark">{t('settings.themeDark')}</option>
                  <option value="auto">{t('settings.themeAuto')}</option>
                </select>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('settings.memoryBackend')}
                </label>
                <select
                  value={settings.memoryBackend}
                  onChange={(e) => setSettings({ ...settings, memoryBackend: e.target.value as Settings['memoryBackend'] })}
                  className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="respire">{t('settings.memoryBackendRespire')}</option>
                  <option value="markdown">{t('settings.memoryBackendMarkdown')}</option>
                  <option value="off">{t('settings.memoryBackendOff')}</option>
                </select>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.memoryReview}
                    onChange={(e) => setSettings({ ...settings, memoryReview: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('settings.memoryReview')}
                  </span>
                </label>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('settings.maxSessions')}
                </label>
                <input
                  type="number"
                  value={settings.maxSessions}
                  onChange={(e) => setSettings({ ...settings, maxSessions: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  min="1"
                  max="64"
                />
              </div>

              {saveError && <p className="text-red-600">{saveError}</p>}

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
