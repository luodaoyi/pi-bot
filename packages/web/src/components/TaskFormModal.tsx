import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { ScheduledTask, Bot, Group } from '@/types';
import { createApiClient } from '@/api';

const api = createApiClient();

interface TaskFormModalProps {
  task?: ScheduledTask;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ task, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [bots, setBots] = useState<Bot[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    targetType: 'bot' as 'bot' | 'group',
    targetId: '',
    message: '',
    scheduleType: 'daily' as 'once' | 'daily' | 'weekly' | 'interval',
    time: '09:00',
    days: [] as number[],
    interval: 60,
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (task) {
        setFormData({
          name: task.name,
          targetType: task.targetType,
          targetId: task.targetId,
          message: task.message,
          scheduleType: task.schedule.type,
          time: task.schedule.time || '09:00',
          days: task.schedule.days || [],
          interval: task.schedule.interval || 60,
        });
      } else {
        setFormData({
          name: '',
          targetType: 'bot',
          targetId: '',
          message: '',
          scheduleType: 'daily',
          time: '09:00',
          days: [],
          interval: 60,
        });
      }
      setError(null);
    }
  }, [isOpen, task]);

  const loadData = async () => {
    try {
      const [botsData, groupsData] = await Promise.all([
        api.getBots(),
        api.getGroups(),
      ]);
      setBots(botsData);
      setGroups(groupsData);
      if (!task && botsData.length > 0) {
        setFormData(prev => ({ ...prev, targetId: botsData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const validate = () => {
    if (!formData.name.trim()) {
      setError(t('task.name') + ' is required');
      return false;
    }
    if (!formData.targetId) {
      setError(t('task.target') + ' is required');
      return false;
    }
    if (!formData.message.trim()) {
      setError(t('task.message') + ' is required');
      return false;
    }
    if (formData.scheduleType === 'weekly' && formData.days.length === 0) {
      setError('Select at least one day');
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
      const scheduleData = {
        name: formData.name,
        targetType: formData.targetType,
        targetId: formData.targetId,
        message: formData.message,
        schedule: {
          type: formData.scheduleType,
          time: formData.scheduleType !== 'interval' ? formData.time : undefined,
          days: formData.scheduleType === 'weekly' ? formData.days : undefined,
          interval: formData.scheduleType === 'interval' ? formData.interval : undefined,
        },
      };

      if (task) {
        await api.updateTask(task.id, scheduleData);
      } else {
        await api.createTask(scheduleData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day].sort(),
    }));
  };

  const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  if (!isOpen) return null;

  const targets = formData.targetType === 'bot' ? bots : groups;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {task ? t('task.edit') : t('task.create')}
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
              {t('task.name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Enter task name"
            />
          </div>

          {/* Target Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('task.target')}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.targetType === 'bot'}
                  onChange={() => setFormData({ ...formData, targetType: 'bot', targetId: bots[0]?.id || '' })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-white">{t('task.targetBot')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.targetType === 'group'}
                  onChange={() => setFormData({ ...formData, targetType: 'group', targetId: groups[0]?.id || '' })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900 dark:text-white">{t('task.targetGroup')}</span>
              </label>
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select {formData.targetType} *
            </label>
            <select
              value={formData.targetId}
              onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('task.message')} *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Message to send"
            />
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('task.schedule')}
            </label>
            <select
              value={formData.scheduleType}
              onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as typeof formData.scheduleType })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="once">{t('task.scheduleOnce')}</option>
              <option value="daily">{t('task.scheduleDaily')}</option>
              <option value="weekly">{t('task.scheduleWeekly')}</option>
              <option value="interval">{t('task.scheduleInterval')}</option>
            </select>
          </div>

          {/* Time (for once, daily, weekly) */}
          {formData.scheduleType !== 'interval' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Days (for weekly) */}
          {formData.scheduleType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days *
              </label>
              <div className="flex gap-2">
                {weekDays.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`px-3 py-2 rounded-lg border transition-colors ${
                      formData.days.includes(value)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interval (for interval) */}
          {formData.scheduleType === 'interval' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interval (minutes)
              </label>
              <input
                type="number"
                value={formData.interval}
                onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) })}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
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
