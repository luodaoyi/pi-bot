import React from 'react';
import { useTranslation } from 'react-i18next';
import { THINKING_LEVELS, type ThinkingLevel } from '@/api/types';

interface ThinkingSelectorProps {
  value: ThinkingLevel | null;
  onChange: (value: ThinkingLevel | null) => void;
  allowFollowDefault?: boolean;
  disabled?: boolean;
}

export const ThinkingSelector: React.FC<ThinkingSelectorProps> = ({
  value,
  onChange,
  allowFollowDefault = true,
  disabled,
}) => {
  const { t } = useTranslation();
  return (
    <select
      data-testid="thinking-selector"
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? (e.target.value as ThinkingLevel) : null)}
      className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm"
    >
      {allowFollowDefault && <option value="">{t('model.thinkingFollow')}</option>}
      {THINKING_LEVELS.map((level) => (
        <option key={level} value={level}>
          {t(`model.thinking.${level}`)}
        </option>
      ))}
    </select>
  );
};
