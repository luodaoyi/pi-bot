import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

export const ThinkingBlock: React.FC<{ text: string; streaming?: boolean }> = ({ text, streaming }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const preview = text.replace(/\s+/g, ' ').slice(0, 72);

  return (
    <div
      data-testid="thinking-block"
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-sm text-gray-600 dark:text-gray-300"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight size={14} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
        <span className="font-medium text-gray-700 dark:text-gray-200">{t('chat.thinking')}</span>
        {!open && (
          <span className="truncate text-gray-400">
            {preview}
            {streaming ? '…' : ''}
          </span>
        )}
      </button>
      {open && (
        <pre className="px-3 pb-3 whitespace-pre-wrap font-mono text-xs text-gray-500 dark:text-gray-400">
          {text}
        </pre>
      )}
    </div>
  );
};
