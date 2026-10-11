import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon } from 'lucide-react';
import { createApiClient } from '@/api';
import type { Settings } from '@/types';

const api = createApiClient();

export const SettingsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      await api.updateSettings(settings);
      i18n.changeLanguage(settings.language);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

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
        <div className="max-w-2xl space-y-6">
          {/* Language */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('settings.language')}
            </label>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value as 'zh-CN' | 'en-US' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </div>

          {/* Theme */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('settings.theme')}
            </label>
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'auto' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="auto">{t('settings.themeAuto')}</option>
            </select>
          </div>

          {/* Memory Backend */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('settings.memoryBackend')}
            </label>
            <select
              value={settings.memoryBackend}
              onChange={(e) => setSettings({ ...settings, memoryBackend: e.target.value as 'respire' | 'markdown' | 'off' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="respire">{t('settings.memoryBackendRespire')}</option>
              <option value="markdown">{t('settings.memoryBackendMarkdown')}</option>
              <option value="off">{t('settings.memoryBackendOff')}</option>
            </select>
          </div>

          {/* Memory Review */}
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

          {/* Max Sessions */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('settings.maxSessions')}
            </label>
            <input
              type="number"
              value={settings.maxSessions}
              onChange={(e) => setSettings({ ...settings, maxSessions: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              min="1"
              max="64"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
