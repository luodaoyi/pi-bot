import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit, Trash2, Brain } from 'lucide-react';
import { createApiClient } from '@/api';
import type { MemoryEntry } from '@/types';
import { MemoryFormModal } from '@/components/MemoryFormModal';

const api = createApiClient();

export const MemoryView: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'bot' | 'team'>('all');
  const [summary, setSummary] = useState('');
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | undefined>(undefined);

  const loadMemory = async () => {
    setLoading(true);
    try {
      const results = await api.searchMemory({
        query: searchQuery || undefined,
        scope: scope === 'all' ? undefined : scope,
        limit: 50,
      });
      setEntries(results);
      
      // Load summary for team scope
      if (scope === 'team') {
        const sum = await api.getMemorySummary('team');
        setSummary(sum);
      }
    } catch (error) {
      console.error('Failed to load memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemory = () => {
    setEditingEntry(undefined);
    setShowMemoryModal(true);
  };

  const handleEditMemory = (entry: MemoryEntry) => {
    setEditingEntry(entry);
    setShowMemoryModal(true);
  };

  const handleDeleteMemory = async (entry: MemoryEntry) => {
    if (!confirm(`${t('common.delete')} this memory?`)) return;
    try {
      await api.forgetMemory(entry.id);
      await loadMemory();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const handleMemorySuccess = async () => {
    await loadMemory();
  };

  useEffect(() => {
    loadMemory();
  }, [scope]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
          <button
            onClick={handleCreateMemory}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('memory.write')}
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadMemory()}
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
            onClick={loadMemory}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.search')}
          </button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">{summary}</p>
          </div>
        )}
      </div>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">{t('common.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-500 py-8">{t('memory.noResults')}</div>
        ) : (
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
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditMemory(entry)}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteMemory(entry)}
                      className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`px-2 py-1 rounded ${
                    entry.scope === 'team'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  }`}>
                    {t(`memory.scope${entry.scope.charAt(0).toUpperCase() + entry.scope.slice(1)}`)}
                  </span>
                  <span className={`px-2 py-1 rounded ${
                    entry.importance === 'important'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {t(`memory.importance${entry.importance.charAt(0).toUpperCase() + entry.importance.slice(1)}`)}
                  </span>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MemoryFormModal
        entry={editingEntry}
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
        onSuccess={handleMemorySuccess}
      />
    </div>
  );
};
