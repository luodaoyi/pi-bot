import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { MemoryEntry } from '@/types';
import { createApiClient } from '@/api';
import { useAppStore } from '@/stores';

const api = createApiClient();

interface MemoryFormModalProps {
  entry?: MemoryEntry;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MemoryFormModal: React.FC<MemoryFormModalProps> = ({ entry, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { selectedBotId } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    content: '',
    title: '',
    scope: 'bot' as 'bot' | 'team',
    importance: 'important' as 'important' | 'trivial',
    replace: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setFormData({
          content: entry.content,
          title: entry.title || '',
          scope: entry.scope,
          importance: entry.importance,
          replace: entry.content, // For update, use original content as replace target
        });
      } else {
        setFormData({
          content: '',
          title: '',
          scope: 'bot',
          importance: 'important',
          replace: '',
        });
      }
      setError(null);
    }
  }, [isOpen, entry]);

  const validate = () => {
    if (!formData.content.trim()) {
      setError(t('memory.content') + ' is required');
      return false;
    }
    if (formData.content.length > 300) {
      setError('Content must be 300 characters or less');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!selectedBotId && formData.scope === 'bot') {
      setError('No bot selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (entry) {
        await api.updateMemory(entry.id, formData.content);
      } else {
        const botId = selectedBotId || 'bot-chief';
        await api.writeMemory(botId, {
          content: formData.content,
          title: formData.title || undefined,
          scope: formData.scope,
          importance: formData.importance,
          replace: formData.replace || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memory');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {entry ? t('memory.update') : t('memory.write')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('memory.content')} * (max 300 chars)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              maxLength={300}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Enter memory content (fact or preference)"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.content.length} / 300 characters
            </p>
          </div>

          {!entry && (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memory.title')}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Optional title"
                />
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memory.scope')}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.scope === 'bot'}
                      onChange={() => setFormData({ ...formData, scope: 'bot' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">{t('memory.scopeBot')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.scope === 'team'}
                      onChange={() => setFormData({ ...formData, scope: 'team' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">{t('memory.scopeTeam')}</span>
                  </label>
                </div>
              </div>

              {/* Importance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memory.importance')}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.importance === 'important'}
                      onChange={() => setFormData({ ...formData, importance: 'important' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">{t('memory.importanceImportant')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.importance === 'trivial'}
                      onChange={() => setFormData({ ...formData, importance: 'trivial' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">{t('memory.importanceTrivial')}</span>
                  </label>
                </div>
              </div>

              {/* Replace */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Replace Existing
                </label>
                <input
                  type="text"
                  value={formData.replace}
                  onChange={(e) => setFormData({ ...formData, replace: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Optional: text to replace"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If provided, replaces matching existing entry instead of adding new
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
