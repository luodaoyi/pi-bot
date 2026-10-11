import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelRef, SessionStats, ThinkingLevel } from '@/api/types';

interface SessionInfoPanelProps {
  model: ModelRef | null;
  thinking: ThinkingLevel | null;
  stats: SessionStats;
  followLabel: string;
}

export const SessionInfoPanel: React.FC<SessionInfoPanelProps> = ({
  model,
  thinking,
  stats,
  followLabel,
}) => {
  const { t } = useTranslation();
  const percent = stats.contextUsage?.percent ?? 0;
  const modelLabel = model ? `${model.provider}/${model.id}` : followLabel;

  return (
    <div data-testid="session-info" className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-500 space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>{t('session.model')}: <strong className="text-gray-800 dark:text-gray-100">{modelLabel}</strong></span>
        <span>{t('session.thinking')}: <strong className="text-gray-800 dark:text-gray-100">{thinking ?? t('model.thinkingFollow')}</strong></span>
        <span>in {stats.tokens.input}</span>
        <span>out {stats.tokens.output}</span>
        <span>cache {stats.tokens.cacheRead}/{stats.tokens.cacheWrite}</span>
        <span data-testid="session-cost">${stats.cost.toFixed(4)}</span>
      </div>
      <div data-testid="context-usage-bar">
        <div className="flex justify-between mb-1">
          <span>{t('session.context')}</span>
          <span>
            {stats.contextUsage
              ? `${stats.contextUsage.tokens}/${stats.contextUsage.contextWindow} (${percent.toFixed(1)}%)`
              : t('common.empty')}
          </span>
        </div>
        <div className="h-1.5 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full ${percent > 85 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
