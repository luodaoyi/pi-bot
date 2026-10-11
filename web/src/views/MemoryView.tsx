import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Brain } from 'lucide-react';
import { api, ApiError } from '@/api';
import type { MemoryEntry } from '@/types';
import { PageStatus } from '@/components/PageStatus';

export const MemoryView: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respireDown, setRespireDown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'bot' | 'team'>('all');
  const [summary, setSummary] = useState('');

  const loadMemory = async () => {
    setLoading(true);
    setError(null);
    setRespireDown(false);
    try {
      const status = await api.getMemoryStatus();
      if (!status.available) {
        setRespireDown(true);
        setEntries([]);
        setSummary('');
        setError(status.reason || t('memory.respireNotRunning'));
        return;
      }

      const results = await api.searchMemory({
        query: searchQuery || undefined,
        scope: scope === 'all' ? undefined : scope,
        limit: 50,
      });
      setEntries(results);

      if (scope === 'team') {
        const sum = await api.getMemorySummary('team');
        setSummary(sum);
      } else {
        setSummary('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.loadFailed');
      const down = err instanceof ApiError && (err.status === 503 || /respire/i.test(err.message));
      setRespireDown(down);
      setError(down ? (message || t('memory.respireNotRunning')) : message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMemory();
  }, [scope]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('memory.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('memory.summary')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && void loadMemory()}
              placeholder={t('memory.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">{t('memory.scopeAll')}</option>
            <option value="bot">{t('memory.scopeBot')}</option>
            <option value="team">{t('memory.scopeTeam')}</option>
          </select>
          <button
            type="button"
            onClick={() => void loadMemory()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.search')}
          </button>
        </div>

        {summary && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">{summary}</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <PageStatus
          loading={loading}
          error={error}
          empty={!loading && !error && entries.length === 0}
          emptyText={t('memory.noResults')}
          onRetry={() => void loadMemory()}
          state={respireDown ? 'respire-down' : undefined}
        >
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {entry.title && (
                      <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                        {entry.title}
                      </h3>
                    )}
                    <p className="text-gray-700 dark:text-gray-300">{entry.content}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>{entry.scope}</span>
                  <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </PageStatus>
      </div>
    </div>
  );
};
