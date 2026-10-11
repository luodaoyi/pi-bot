import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { createApiClient } from '@/api';
import type { UsageStats } from '@/types';

const api = createApiClient();

export const UsageView: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getUsageStats(period);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [period]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('usage.title')}
              </h1>
            </div>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="day">{t('usage.periodDay')}</option>
            <option value="week">{t('usage.periodWeek')}</option>
            <option value="month">{t('usage.periodMonth')}</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">{t('common.loading')}</div>
        ) : !stats ? (
          <div className="text-center text-gray-500 py-8">No data</div>
        ) : (
          <div className="space-y-6">
            {/* Total */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t('usage.total')}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('usage.inputTokens')}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(stats.total.inputTokens)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('usage.outputTokens')}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(stats.total.outputTokens)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('usage.cost')}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    ${stats.total.cost?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>
            </div>

            {/* By Bot */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t('usage.byBot')}
              </h2>
              <div className="space-y-3">
                {Object.entries(stats.byBot).map(([botId, data]) => (
                  <div key={botId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {botId}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {formatNumber(data.inputTokens)} in
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {formatNumber(data.outputTokens)} out
                      </span>
                      <span className="text-blue-600 font-medium">
                        ${data.cost?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
