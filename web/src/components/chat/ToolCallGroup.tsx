import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import type { PiToolCall, ToolDisplayMode } from '@/api/types';
import { ToolCallCard } from './ToolCallCard';
import { countToolNames, parseCreatedSession } from './tool-summary';

export const ToolCallGroup: React.FC<{
  tools: PiToolCall[];
  display?: ToolDisplayMode;
  onOpenSession?: (sessionId: string, botId?: string) => void;
}> = ({ tools, display = 'collapsed', onOpenSession }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(display === 'expanded');
  const running = tools.some((tool) => tool.status === 'running' || tool.status === 'pending');
  const failed = tools.some((tool) => tool.status === 'error' || tool.isError);
  const names = useMemo(() => countToolNames(tools), [tools]);
  const created = useMemo(
    () => tools.map(parseCreatedSession).find((item): item is NonNullable<typeof item> => Boolean(item)),
    [tools]
  );

  if (display === 'hidden' || tools.length === 0) return null;

  const label = running
    ? t('chat.toolGroupRunning', { count: tools.length, names })
    : t('chat.toolGroupDone', { count: tools.length, names });

  return (
    <div
      data-testid="tool-group"
      data-tool-count={tools.length}
      data-open={open ? 'true' : 'false'}
      data-running={running ? 'true' : 'false'}
      data-failed={failed ? 'true' : 'false'}
      className={`rounded-lg border text-sm ${
        failed
          ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60'
      }`}
    >
      <button
        type="button"
        data-testid="tool-group-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <ChevronRight size={14} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
        {running && <Loader2 size={14} className="animate-spin text-emerald-600" data-testid="tool-group-spinner" />}
        {failed && !running && <AlertCircle size={14} className="text-red-500" data-testid="tool-group-error" />}
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{label}</span>
      </button>
      {created && (
        <div className="px-3 pb-2">
          <button
            type="button"
            data-testid="created-session-link"
            className="text-xs text-blue-600 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSession?.(created.sessionId, created.botId);
            }}
          >
            {t('chat.createdSession', { name: created.name || created.sessionId })}
          </button>
        </div>
      )}
      {open && (
        <div data-testid="tool-group-list" className="px-2 pb-2 space-y-1.5">
          {tools.map((tool) => (
            <ToolCallCard key={tool.id} tool={tool} compact />
          ))}
        </div>
      )}
    </div>
  );
};
