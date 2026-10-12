import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import type { PiToolCall } from '@/api/types';
import { formatDuration, plainToolOutput, toolOneLineSummary } from './tool-summary';

const OUTPUT_LIMIT = 800;

export const ToolCallCard: React.FC<{
  tool: PiToolCall;
  defaultOpen?: boolean;
  compact?: boolean;
}> = ({ tool, defaultOpen = false, compact = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const errored = tool.status === 'error' || tool.isError;
  const running = tool.status === 'running' || tool.status === 'pending';
  const output = plainToolOutput(tool);
  const truncated = !showAll && output.length > OUTPUT_LIMIT;
  const visible = truncated ? `${output.slice(0, OUTPUT_LIMIT).trimEnd()}\n…` : output;
  const argsText = JSON.stringify(tool.arguments ?? {}, null, 2);
  const summary = toolOneLineSummary(tool);
  const duration = formatDuration(tool.durationMs);

  return (
    <div
      data-testid="tool-card"
      data-tool-name={tool.name}
      data-tool-status={tool.status}
      className={`rounded-lg border overflow-hidden text-sm ${
        errored
          ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight size={14} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
        {running ? (
          <Loader2 size={14} className="animate-spin text-emerald-600" />
        ) : errored ? (
          <AlertCircle size={14} className="text-red-500" />
        ) : (
          <CheckCircle2 size={14} className="text-emerald-600" />
        )}
        <span className="font-mono font-semibold text-xs">{tool.name}</span>
        <span className="text-xs text-gray-400 truncate flex-1">{summary || (running ? t('chat.toolRunning') : '')}</span>
        {duration && <span className="text-[11px] text-gray-400 shrink-0">{duration}</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {!compact && (
            <div>
              <div className="text-xs text-gray-400 mb-1">{t('chat.toolArgs')}</div>
              <pre className="text-xs bg-white/70 dark:bg-gray-950/40 rounded p-2 overflow-auto">{argsText}</pre>
            </div>
          )}
          {compact && (
            <div>
              <div className="text-xs text-gray-400 mb-1">{t('chat.toolArgs')}</div>
              <pre className="text-xs bg-white/70 dark:bg-gray-950/40 rounded p-2 overflow-auto">{argsText}</pre>
            </div>
          )}
          {(tool.liveOutput || running) && !tool.result && (
            <div>
              <div className="text-xs text-gray-400 mb-1">{t('chat.toolLive')}</div>
              <pre className="text-xs bg-white/70 dark:bg-gray-950/40 rounded p-2 overflow-auto whitespace-pre-wrap">
                {plainToolOutput({ ...tool, result: tool.liveOutput }) || t('chat.toolRunning')}
              </pre>
            </div>
          )}
          {tool.result !== undefined && (
            <div>
              <div className="text-xs text-gray-400 mb-1">{errored ? t('chat.toolError') : t('chat.toolResult')}</div>
              <pre className={`text-xs rounded p-2 overflow-auto whitespace-pre-wrap ${errored ? 'text-red-600' : 'bg-white/70 dark:bg-gray-950/40'}`}>
                {visible || t('chat.toolEmpty')}
              </pre>
              {truncated && (
                <button
                  type="button"
                  data-testid="tool-show-more"
                  className="mt-1 text-xs text-blue-600"
                  onClick={() => setShowAll(true)}
                >
                  {t('chat.showMore')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
