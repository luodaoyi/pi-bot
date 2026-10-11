import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Brain, X } from 'lucide-react';
import { marked } from 'marked';
import { api, ApiError } from '@/api';
import type { MemoryEntry } from '@/types';
import { PageStatus } from '@/components/PageStatus';

function renderMarkdown(source: string): string {
  return String(marked.parse(source || '', { async: false }));
}

const COUNT_KEYS = /alive|tomb|index|count|total|pending|remote|local/i;

export const MemoryView: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respireDown, setRespireDown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityMode, setQualityMode] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<MemoryEntry | null>(null);
  const [detailHtml, setDetailHtml] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  const visibleCounts = useMemo(() => {
    return Object.entries(counts).filter(([key]) => COUNT_KEYS.test(key));
  }, [counts]);

  const loadMemory = async () => {
    setLoading(true);
    setError(null);
    setRespireDown(false);
    try {
      const status = await api.getMemoryStatus();
      if (!status.available) {
        setRespireDown(true);
        setEntries([]);
        setCounts({});
        setError(status.reason || t('memory.respireNotRunning'));
        return;
      }
      setCounts(status.counts || {});

      const results = await api.searchMemory({
        query: searchQuery.trim() || undefined,
        limit: 50,
        mode: qualityMode ? 'quality' : 'fast',
      });
      setEntries(results);
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
  }, []);

  const openDetail = async (entry: MemoryEntry) => {
    setDetail(entry);
    setDetailLoading(true);
    try {
      const full = await api.getMemoryEntry(entry.id);
      setDetail(full);
      setDetailHtml(renderMarkdown(full.content || ''));
    } catch {
      setDetailHtml(renderMarkdown(entry.content || ''));
    } finally {
      setDetailLoading(false);
    }
  };

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
                {searchQuery.trim() ? t('memory.search') : t('memory.latest')}
              </p>
            </div>
          </div>
        </div>

        {visibleCounts.length > 0 && (
          <div data-testid="memory-counts" className="flex flex-wrap gap-2 mb-4">
            {visibleCounts.map(([key, value]) => (
              <span
                key={key}
                data-count-key={key}
                className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              data-testid="memory-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadMemory()}
              placeholder={t('memory.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
            <input
              type="checkbox"
              data-testid="memory-quality"
              checked={qualityMode}
              onChange={(e) => setQualityMode(e.target.checked)}
            />
            {t('memory.qualityMode')}
          </label>
          <button
            type="button"
            data-testid="memory-search-submit"
            onClick={() => void loadMemory()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.search')}
          </button>
        </div>
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
              <button
                type="button"
                key={entry.id}
                data-testid="memory-entry"
                data-memory-id={entry.id}
                onClick={() => void openDetail(entry)}
                className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400"
              >
                <h3
                  data-testid="memory-entry-title"
                  className="font-medium text-gray-900 dark:text-white mb-2"
                >
                  {entry.title || entry.id}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {entry.kind && <span>{t('memory.kind')}: {entry.kind}</span>}
                  <span>{t('memory.importance')}: {entry.importance}</span>
                  {entry.project ? <span>{t('memory.project')}: {entry.project}</span> : null}
                  <span>
                    {t('memory.updatedAt')}: {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : ''}
                  </span>
                  {typeof entry.score === 'number' && (
                    <span>score: {entry.score.toFixed(2)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </PageStatus>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div
            data-testid="memory-detail"
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {detail.title || t('memory.detail')}
              </h2>
              <button
                type="button"
                data-testid="memory-detail-close"
                onClick={() => setDetail(null)}
                className="p-1 text-gray-500 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>
            {detailLoading ? (
              <p className="text-gray-500">{t('common.loading')}</p>
            ) : (
              <div
                data-testid="memory-detail-content"
                className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-100 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: detailHtml }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
