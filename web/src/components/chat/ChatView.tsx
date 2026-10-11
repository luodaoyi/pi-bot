import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Square } from 'lucide-react';
import { PageStatus } from '@/components/PageStatus';
import { MarkdownView } from './MarkdownView';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';
import { ChatError } from './ChatError';
import { ModelPicker } from '@/components/models/ModelPicker';
import { ThinkingSelector } from '@/components/models/ThinkingSelector';
import { SessionInfoPanel } from '@/components/session/SessionInfoPanel';
import type { Bot } from '@/types';
import type { ModelRef, PiModel, SessionDetail, ThinkingLevel } from '@/api/types';
import type { ChatRuntime } from '@/stores/chat-events';

interface ChatViewProps {
  bot: Bot | undefined;
  chat: ChatRuntime;
  models: PiModel[];
  session: SessionDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSend: (text: string) => Promise<void>;
  onAbort: () => Promise<void>;
  onModelChange: (model: ModelRef | null) => void;
  onThinkingChange: (level: ThinkingLevel | null) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  bot,
  chat,
  models,
  session,
  loading,
  error,
  onRetry,
  onSend,
  onAbort,
  onModelChange,
  onThinkingChange,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.isStreaming]);

  const handleSend = async () => {
    if (!input.trim() || chat.isStreaming) return;
    const text = input;
    setInput('');
    await onSend(text);
  };

  if (loading && chat.messages.length === 0 && !error) {
    return <PageStatus loading error={null} />;
  }

  return (
    <div data-state="ready" data-testid="chat-view" className="flex-1 flex flex-col h-full min-w-0">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: bot?.look?.color || '#3b82f6' }}
        >
          {bot?.look?.avatar || '🤖'}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-white truncate">{bot?.name}</div>
          <div className="text-xs text-gray-400 truncate">{bot?.role}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 min-w-0">
          <div className="w-52">
            <ModelPicker
              models={models}
              value={session?.session.model ?? bot?.model ?? null}
              onChange={onModelChange}
            />
          </div>
          <ThinkingSelector
            value={session?.session.thinking ?? bot?.thinking ?? null}
            onChange={onThinkingChange}
          />
        </div>
      </div>

      <SessionInfoPanel
        model={session?.session.model ?? bot?.model ?? null}
        thinking={session?.session.thinking ?? bot?.thinking ?? null}
        stats={session?.stats ?? chat.stats}
        followLabel={t('model.followDefault')}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && chat.messages.length === 0 && (
          <PageStatus loading={false} error={error} onRetry={onRetry} />
        )}
        {chat.messages.length === 0 && !error && (
          <div data-state="empty" className="text-center text-gray-400 py-8">{t('bot.chat')}</div>
        )}
        {chat.messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl w-full space-y-2 ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
              {message.role === 'user' ? (
                <div className="max-w-2xl px-4 py-2 rounded-lg bg-blue-600 text-white whitespace-pre-wrap">
                  {message.content}
                </div>
              ) : (
                <>
                  {message.thinking && <ThinkingBlock text={message.thinking} streaming={message.streaming} />}
                  {message.toolCalls?.map((tool) => <ToolCallCard key={tool.id} tool={tool} />)}
                  {message.content && (
                    <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                      <MarkdownView text={message.content} />
                      {message.streaming && <span className="inline-block ml-1 animate-pulse">▋</span>}
                    </div>
                  )}
                  {message.error && <ChatError error={message.error} />}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={t('common.send')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled={chat.isStreaming}
          />
          {chat.isStreaming ? (
            <button
              type="button"
              data-testid="chat-abort"
              onClick={() => void onAbort()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
            >
              <Square size={14} />
              {t('chat.abort')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSend()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('common.send')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
