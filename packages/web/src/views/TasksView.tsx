import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Plus, Edit, Trash2, Clock } from 'lucide-react';
import { createApiClient } from '@/api';
import type { ScheduledTask } from '@/types';
import { TaskFormModal } from '@/components/TaskFormModal';

const api = createApiClient();

export const TasksView: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | undefined>(undefined);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (id: string, enabled: boolean) => {
    try {
      await api.toggleTask(id, enabled);
      await loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(undefined);
    setShowTaskModal(true);
  };

  const handleEditTask = (task: ScheduledTask) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (task: ScheduledTask) => {
    if (!confirm(`${t('common.delete')} "${task.name}"?`)) return;
    try {
      await api.deleteTask(task.id);
      await loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleTaskSuccess = async () => {
    await loadTasks();
  };

  useEffect(() => {
    loadTasks();
  }, []);

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
            onClick={handleCreateTask}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('task.create')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">{t('common.loading')}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">{t('task.noTasks')}</div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
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
                        {task.schedule.type === 'daily' && `${t('task.scheduleDaily')} ${task.schedule.time}`}
                        {task.schedule.type === 'weekly' && `${t('task.scheduleWeekly')} ${task.schedule.time}`}
                        {task.schedule.type === 'interval' && `${t('task.scheduleInterval')} ${task.schedule.interval}m`}
                      </span>
                      {task.nextRun && (
                        <span>
                          {t('task.nextRun')}: {new Date(task.nextRun).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onChange={(e) => toggleTask(task.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                    <button
                      onClick={() => handleEditTask(task)}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskFormModal
        task={editingTask}
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSuccess={handleTaskSuccess}
      />
    </div>
  );
};
