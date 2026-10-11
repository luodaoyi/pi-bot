import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Plus, Clock } from 'lucide-react';
import { api } from '@/api';
import type { ScheduledTask, Bot } from '@/types';
import { PageStatus } from '@/components/PageStatus';

export const TasksView: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [botId, setBotId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, botList] = await Promise.all([api.getTasks(), api.getBots()]);
      setTasks(data);
      setBots(botList);
      if (!botId && botList[0]) setBotId(botList[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (id: string, enabled: boolean) => {
    try {
      await api.toggleTask(id, enabled);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !message.trim() || !botId) return;
    setSaving(true);
    try {
      const task = await api.createTask({
        name: name.trim(),
        targetType: 'bot',
        targetId: botId,
        message: message.trim(),
        schedule: { type: 'daily', time: '09:00' },
      });
      setTasks((prev) => [...prev, task]);
      setShowCreate(false);
      setName('');
      setMessage('');
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
            <Calendar className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('task.list')}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('task.create')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <PageStatus
          loading={loading}
          error={error}
          empty={!loading && !error && tasks.length === 0}
          emptyText={t('task.empty')}
          onRetry={() => void loadTasks()}
        >
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                data-task-name={task.name}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {task.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {task.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {task.schedule.type} {task.schedule.time}
                      </span>
                      {task.nextRun && (
                        <span>
                          {t('task.nextRun')}: {new Date(task.nextRun).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      onChange={(e) => void toggleTask(task.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </PageStatus>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">{t('task.create')}</h2>
            <input
              data-testid="task-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('task.name')}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <textarea
              data-testid="task-message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('task.message')}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <select
              data-testid="task-bot-select"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
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
                data-testid="task-create-submit"
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
