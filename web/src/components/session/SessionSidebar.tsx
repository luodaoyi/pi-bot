import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { GitFork, Pencil, Plus, Trash2 } from 'lucide-react';
import type { SessionSummary } from '@/api/types';

interface SessionSidebarProps {
  sessions: SessionSummary[];
  activeId: string | null;
  supported: boolean;
  loading: boolean;
  error?: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeId,
  supported,
  loading,
  error,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onFork,
}) => {
  const { t, i18n } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const locale = i18n.language.startsWith('zh') ? zhCN : enUS;

  return (
    <div data-testid="session-sidebar" className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('session.list')}</span>
        <button
          type="button"
          data-testid="session-new"
          onClick={onCreate}
          disabled={!supported}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
          title={t('session.new')}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && sessions.length === 0 ? (
          <div data-state="loading" className="text-center text-gray-400 text-sm py-6">{t('common.loading')}</div>
        ) : error ? (
          <div data-state="error" className="text-center text-red-500 text-sm p-3">{error}</div>
        ) : !supported ? (
          <div data-state="empty" className="text-center text-gray-400 text-xs p-3">{t('session.unsupported')}</div>
        ) : sessions.length === 0 ? (
          <div data-state="empty" className="text-center text-gray-400 text-sm py-6">{t('session.empty')}</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              data-testid="session-item"
              data-session-id={session.id}
              data-session-active={session.isActive || session.id === activeId ? 'true' : 'false'}
              className={`border-b border-gray-100 dark:border-gray-700 ${
                session.id === activeId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              {editingId === session.id ? (
                <form
                  className="p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) onRename(session.id, draft.trim());
                    setEditingId(null);
                  }}
                >
                  <input
                    data-testid="session-rename-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded"
                    autoFocus
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className="w-full text-left px-3 py-2"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{session.name || session.id}</div>
                  <div className="text-xs text-gray-400 flex justify-between">
                    <span>
                      {session.updatedAt
                        ? formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale })
                        : ''}
                    </span>
                    <span>{t('session.messages', { count: session.messageCount })}</span>
                  </div>
                </button>
              )}
              <div className="flex justify-end gap-1 px-2 pb-2">
                <button type="button" title={t('session.rename')} onClick={() => { setEditingId(session.id); setDraft(session.name ?? ''); }} className="p-1 text-gray-400 hover:text-gray-700">
                  <Pencil size={12} />
                </button>
                <button type="button" data-testid="session-fork" title={t('session.fork')} onClick={() => onFork(session.id)} className="p-1 text-gray-400 hover:text-gray-700">
                  <GitFork size={12} />
                </button>
                <button type="button" data-testid="session-delete" title={t('common.delete')} onClick={() => onDelete(session.id)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
