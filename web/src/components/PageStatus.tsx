import React from 'react';
import { useTranslation } from 'react-i18next';

interface PageStatusProps {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  state?: string;
  children?: React.ReactNode;
}

export const PageStatus: React.FC<PageStatusProps> = ({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
  state,
  children,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div data-state="loading" className="text-center text-gray-500 py-8">
        {t('common.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div data-state={state || 'error'} className="text-center py-8 space-y-3">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div data-state="empty" className="text-center text-gray-500 py-8">
        {emptyText || t('common.empty')}
      </div>
    );
  }

  return <div data-state={state || 'ready'}>{children}</div>;
};
