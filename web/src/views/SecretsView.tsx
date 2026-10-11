import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus } from 'lucide-react';
import { createApiClient } from '@/api';
import type { Secret } from '@/types';

const api = createApiClient();

export const SecretsView: React.FC = () => {
  const { t } = useTranslation();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSecrets = async () => {
    setLoading(true);
    try {
      const data = await api.getSecrets();
      setSecrets(data);
    } catch (error) {
      console.error('Failed to load secrets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('secret.list')}
              </h1>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={20} />
            {t('secret.request')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">{t('common.loading')}</div>
        ) : secrets.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No secrets</div>
        ) : (
          <div className="space-y-4">
            {secrets.map((secret) => (
              <div
                key={secret.name}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {secret.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {secret.purpose}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('secret.scope')}: {secret.scope.length} bots
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
