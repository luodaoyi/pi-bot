import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus } from 'lucide-react';
import { createApiClient } from '@/api';
import type { Group } from '@/types';

const api = createApiClient();

export const GroupsView: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

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
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={20} />
            {t('group.create')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">{t('common.loading')}</div>
        ) : groups.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No groups</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
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
        )}
      </div>
    </div>
  );
};
