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
    importance: 'important' as 'important' | 'trivial',
    parent: '',
    supersedes: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setFormData({
          content: entry.content,
          title: entry.title || '',
          importance: entry.importance,
          parent: '',
          supersedes: entry.content,
        });
      } else {
        setFormData({
          content: '',
          title: '',
          importance: 'important',
          parent: '',
          supersedes: '',
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
      setError(t('memory.contentMaxLength'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!selectedBotId) {
      setError(t('bot.chat'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (entry) {
        await api.updateMemory(entry.id, formData.content);
      } else {
        await api.writeMemory(selectedBotId, {
          content: formData.content,
          title: formData.title || undefined,
          scope: 'team',
          importance: formData.importance,
          replace: formData.supersedes || undefined,
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
              {t('memory.contentLabel')} * ({t('common.max')} 300)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              maxLength={300}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('memory.enterContent')}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.content.length} / 300
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
                placeholder={t('memory.optionalTitle')}
              />
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

              {/* Parent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memory.parent')} ({t('common.optional')})
                </label>
                <input
                  type="text"
                  value={formData.parent}
                  onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder={t('memory.parent')}
                />
              </div>

              {/* Supersedes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memory.supersedes')} ({t('common.optional')})
                </label>
                <input
                  type="text"
                  value={formData.supersedes}
                  onChange={(e) => setFormData({ ...formData, supersedes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder={t('memory.supersedes')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('memory.replaceHint')}
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
