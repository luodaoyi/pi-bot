import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Bot, ModelInfo } from '@/types';
import { createApiClient } from '@/api';

const api = createApiClient();

interface BotFormModalProps {
  bot?: Bot;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVATAR_OPTIONS = ['🤖', '🦾', '🧠', '⚡', '🌟', '🎯', '🔮', '🎨', '📚', '🔬', '🎭', '🎪', '🎸', '🎮'];
const COLOR_OPTIONS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const BotFormModal: React.FC<BotFormModalProps> = ({ bot, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    instructions: '',
    model: '',
    avatar: '🤖',
    color: '#3b82f6',
  });

  useEffect(() => {
    if (isOpen) {
      loadModels();
      if (bot) {
        setFormData({
          name: bot.name,
          role: bot.role,
          instructions: bot.instructions,
          model: bot.model,
          avatar: bot.avatar || '🤖',
          color: bot.color || '#3b82f6',
        });
      } else {
        setFormData({
          name: '',
          role: '',
          instructions: '',
          model: '',
          avatar: '🤖',
          color: '#3b82f6',
        });
      }
      setError(null);
    }
  }, [isOpen, bot]);

  const loadModels = async () => {
    try {
      const data = await api.getAvailableModels();
      setModels(data);
      if (!bot && data.length > 0) {
        setFormData(prev => ({ ...prev, model: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const validate = () => {
    if (!formData.name.trim()) {
      setError(t('bot.name') + ' is required');
      return false;
    }
    if (!formData.role.trim()) {
      setError(t('bot.role') + ' is required');
      return false;
    }
    if (!formData.instructions.trim()) {
      setError(t('bot.instructions') + ' is required');
      return false;
    }
    if (!formData.model) {
      setError(t('bot.model') + ' is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      if (bot) {
        await api.updateBot(bot.id, formData);
      } else {
        await api.createBot(formData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bot');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {bot ? t('bot.edit') : t('bot.create')}
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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('bot.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('bot.enterBotName')}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('bot.role')} *
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('bot.enterRole')}
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('bot.instructions')} *
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('bot.describePurpose')}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('bot.model')} *
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.contextWindow.toLocaleString()} tokens)
                </option>
              ))}
            </select>
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('bot.avatar')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar })}
                  className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all ${
                    formData.avatar === avatar
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('bot.color')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-12 h-12 rounded-lg border-2 transition-all ${
                    formData.color === color
                      ? 'border-white dark:border-gray-800 ring-2 ring-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

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
