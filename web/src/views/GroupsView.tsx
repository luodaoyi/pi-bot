import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus } from 'lucide-react';
import { api } from '@/api';
import type { Group, Bot } from '@/types';
import { PageStatus } from '@/components/PageStatus';

export const GroupsView: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, botList] = await Promise.all([api.getGroups(), api.getBots()]);
      setGroups(data);
      setBots(botList);
      if (!memberId && botList[0]) {
        setMemberId(botList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !memberId) return;
    setSaving(true);
    try {
      const group = await api.createGroup({
        name: name.trim(),
        members: [memberId],
        admin: [memberId],
        mode: 'everyone',
      });
      setGroups((prev) => [...prev, group]);
      setShowCreate(false);
      setName('');
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
            <Users className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('group.list')}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('group.create')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <PageStatus
          loading={loading}
          error={error}
          empty={!loading && !error && groups.length === 0}
          emptyText={t('group.empty')}
          onRetry={() => void loadGroups()}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                data-group-name={group.name}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {group.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {group.members.length} {t('group.members')}
                </p>
                {group.notice && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    {group.notice}
                  </p>
                )}
              </div>
            ))}
          </div>
        </PageStatus>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">{t('group.create')}</h2>
            <input
              data-testid="group-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('group.name')}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <select
              data-testid="group-member-select"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>{bot.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="group-create-submit"
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
