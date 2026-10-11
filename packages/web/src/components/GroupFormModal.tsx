import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Group, Bot } from '@/types';
import { createApiClient } from '@/api';

const api = createApiClient();

interface GroupFormModalProps {
  group?: Group;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GroupFormModal: React.FC<GroupFormModalProps> = ({ group, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    members: [] as string[],
    admin: '',
    mode: 'everyone' as 'everyone' | 'admin',
    notice: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadBots();
      if (group) {
        setFormData({
          name: group.name,
          members: group.members,
          admin: group.admin,
          mode: group.mode,
          notice: group.notice || '',
        });
      } else {
        setFormData({
          name: '',
          members: [],
          admin: '',
          mode: 'everyone',
          notice: '',
        });
      }
      setError(null);
    }
  }, [isOpen, group]);

  const loadBots = async () => {
    try {
      const data = await api.getBots();
      setBots(data);
      if (!group && data.length > 0) {
        const mainBot = data.find(b => b.isMain) || data[0];
        setFormData(prev => ({ ...prev, admin: mainBot.id }));
      }
    } catch (err) {
      console.error('Failed to load bots:', err);
    }
  };

  const validate = () => {
    if (!formData.name.trim()) {
      setError(t('group.name') + ' is required');
      return false;
    }
    if (formData.members.length < 2) {
      setError(t('group.minMembers'));
      return false;
    }
    if (!formData.admin) {
      setError(t('group.admin') + ' ' + t('common.required'));
      return false;
    }
    if (!formData.members.includes(formData.admin)) {
      setError(t('group.adminMustBeMember'));
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
      if (group) {
        await api.updateGroup(group.id, formData);
      } else {
        await api.createGroup(formData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (botId: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.includes(botId)
        ? prev.members.filter(id => id !== botId)
        : [...prev.members, botId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {group ? t('group.edit') : t('group.create')}
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
              {t('group.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('group.enterGroupName')}
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('group.members')} * ({t('common.min')} 2)
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
              {bots.map((bot) => (
                <label
                  key={bot.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.members.includes(bot.id)}
                    onChange={() => toggleMember(bot.id)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-lg"
                    style={{ backgroundColor: bot.color || '#3b82f6' }}
                  >
                    {bot.avatar || '🤖'}
                  </div>
                  <span className="text-gray-900 dark:text-white">{bot.name}</span>
                  {bot.isMain && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                      Main
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Selected: {formData.members.length}
            </p>
          </div>

          {/* Admin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('group.admin')} *
            </label>
            <select
              value={formData.admin}
              onChange={(e) => setFormData({ ...formData, admin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">{t('group.selectAdmin')}</option>
              {bots
                .filter(bot => formData.members.includes(bot.id))
                .map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} {bot.isMain ? '(Main)' : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('group.mode')}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.mode === 'everyone'}
                  onChange={() => setFormData({ ...formData, mode: 'everyone' })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-white">{t('group.modeEveryone')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.mode === 'admin'}
                  onChange={() => setFormData({ ...formData, mode: 'admin' })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-white">{t('group.modeAdmin')}</span>
              </label>
            </div>
          </div>

          {/* Notice */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('group.notice')}
            </label>
            <textarea
              value={formData.notice}
              onChange={(e) => setFormData({ ...formData, notice: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('group.optionalNotice')}
            />
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
