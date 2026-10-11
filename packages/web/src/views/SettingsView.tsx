import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Activity, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { createApiClient } from '@/api';
import type { Settings } from '@/types';

const api = createApiClient();

interface RespireStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

export const SettingsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [respireStatus, setRespireStatus] = useState<RespireStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingRespire, setCheckingRespire] = useState(false);

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

  const checkRespireStatus = async () => {
    setCheckingRespire(true);
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setRespireStatus({
          connected: data.respire === 'connected',
          version: data.respireVersion,
        });
      } else {
        setRespireStatus({
          connected: false,
          error: 'Health check failed',
        });
      }
    } catch (error) {
      setRespireStatus({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setCheckingRespire(false);
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
    checkRespireStatus();
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

          {/* Respire Memory Status */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Activity size={18} />
                {t('settings.respireStatus')}
              </label>
              <button
                onClick={checkRespireStatus}
                disabled={checkingRespire}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                title="Refresh status"
              >
                <RefreshCw size={16} className={checkingRespire ? 'animate-spin' : ''} />
              </button>
            </div>

            {respireStatus ? (
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                respireStatus.connected
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                {respireStatus.connected ? (
                  <CheckCircle className="flex-shrink-0 text-green-600 dark:text-green-400" size={20} />
                ) : (
                  <XCircle className="flex-shrink-0 text-red-600 dark:text-red-400" size={20} />
                )}
                <div className="flex-1">
                  <div className={`font-medium ${
                    respireStatus.connected
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {respireStatus.connected ? 'Connected' : 'Disconnected'}
                  </div>
                  {respireStatus.version && (
                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Version: {respireStatus.version}
                    </div>
                  )}
                  {respireStatus.error && (
                    <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {respireStatus.error}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                {checkingRespire ? 'Checking...' : 'Status unknown'}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              pi-bot uses a single global Respire memory backend for all bots. Memory is persistent across sessions.
            </p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Maximum concurrent chat sessions to keep in memory
            </p>
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
