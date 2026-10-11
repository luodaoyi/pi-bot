import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus } from 'lucide-react';
import { api } from '@/api';
import type { Secret } from '@/types';
import { PageStatus } from '@/components/PageStatus';

export const SecretsView: React.FC = () => {
  const { t } = useTranslation();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSecrets = async () => {
    setLoading(true);
    setError(null);
    try {
      setSecrets(await api.getSecrets());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSecrets();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !value.trim()) return;
    setSaving(true);
    try {
      await api.requestSecret({
        name: name.trim(),
        purpose: purpose.trim() || name.trim(),
        value: value.trim(),
      });
      await loadSecrets();
      setShowCreate(false);
      setName('');
      setPurpose('');
      setValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

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
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('secret.request')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <PageStatus
          loading={loading}
          error={error}
          empty={!loading && !error && secrets.length === 0}
          emptyText={t('secret.empty')}
          onRetry={() => void loadSecrets()}
        >
          <div className="space-y-4">
            {secrets.map((secret) => (
              <div
                key={secret.name}
                data-secret-name={secret.name}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
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
            ))}
          </div>
        </PageStatus>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">{t('secret.request')}</h2>
            <input
              data-testid="secret-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('secret.name')}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              data-testid="secret-purpose-input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t('secret.purpose')}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              data-testid="secret-value-input"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('secret.valuePlaceholder')}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="secret-create-submit"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
