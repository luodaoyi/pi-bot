import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { PiToolCall } from '@/api/types';

export const ToolCallCard: React.FC<{ tool: PiToolCall }> = ({ tool }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(tool.status === 'running' || tool.status === 'error');
  const errored = tool.status === 'error' || tool.isError;
  const args = JSON.stringify(tool.arguments ?? {}, null, 2);

  return (
    <div
      data-testid="tool-card"
      data-tool-name={tool.name}
      data-tool-status={tool.status}
      className={`rounded-lg border overflow-hidden text-sm ${
        errored
          ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10'
          : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight size={14} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
        {tool.status === 'running' || tool.status === 'pending' ? (
          <Loader2 size={14} className="animate-spin text-emerald-600" />
        ) : errored ? (
          <AlertCircle size={14} className="text-red-500" />
        ) : (
          <CheckCircle2 size={14} className="text-emerald-600" />
        )}
        <span className="font-mono font-semibold text-xs">{tool.name}</span>
        <span className="text-xs text-gray-400 truncate flex-1">
          {tool.status === 'running' ? t('chat.toolRunning') : Object.keys(tool.arguments || {}).join(', ')}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <div className="text-xs text-gray-400 mb-1">{t('chat.toolArgs')}</div>
            <pre className="text-xs bg-white/70 dark:bg-gray-950/40 rounded p-2 overflow-auto">{args}</pre>
          </div>
          {(tool.liveOutput || tool.status === 'running') && (
            <div>
              <div className="text-xs text-gray-400 mb-1">{t('chat.toolLive')}</div>
              <pre className="text-xs bg-white/70 dark:bg-gray-950/40 rounded p-2 overflow-auto">
                {tool.liveOutput || t('chat.toolRunning')}
              </pre>
            </div>
          )}
          {tool.result !== undefined && (
            <div>
              <div className="text-xs text-gray-400 mb-1">{errored ? t('chat.toolError') : t('chat.toolResult')}</div>
              <pre className={`text-xs rounded p-2 overflow-auto ${errored ? 'text-red-600' : 'bg-white/70 dark:bg-gray-950/40'}`}>
                {tool.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
