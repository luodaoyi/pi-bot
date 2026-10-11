import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useAppStore } from '@/stores';
import { PageStatus } from '@/components/PageStatus';

export const BotsView: React.FC = () => {
  const { t } = useTranslation();
  const { bots, loadBots, selectBot, selectedBotId, createBot, loading, error } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void loadBots();
  }, [loadBots]);

  const handleCreate = async () => {
    if (!name.trim() || !role.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await createBot({
        name: name.trim(),
        role: role.trim(),
        instructions: instructions.trim() || role.trim(),
      });
      setShowCreateModal(false);
      setName('');
      setRole('');
      setInstructions('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('bot.create')}
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading && bots.length === 0 ? (
            <div data-state="loading" className="text-center text-gray-500 py-8">
              {t('common.loading')}
            </div>
          ) : error && bots.length === 0 ? (
            <PageStatus loading={false} error={error} onRetry={() => void loadBots()} />
          ) : bots.length === 0 ? (
            <div data-state="empty" className="text-center text-gray-500 py-8">
              {t('bot.empty')}
            </div>
          ) : (
            bots.map((bot) => (
              <button
                type="button"
                key={bot.id}
                onClick={() => void selectBot(bot.id)}
                data-bot-name={bot.name}
                className={`
                  w-full p-4 text-left border-b border-gray-200 dark:border-gray-700
                  transition-colors
                  ${selectedBotId === bot.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                    style={{ backgroundColor: bot.look?.color || '#3b82f6' }}
                  >
                    {bot.look?.avatar || '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {bot.name}
                      {bot.isMain && (
                        <span className="ml-2 text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                          {t('bot.isMain')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {bot.role}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedBotId ? (
          <ChatArea botId={selectedBotId} />
        ) : (
          <div data-state={loading ? 'loading' : 'empty'} className="flex-1 flex items-center justify-center text-gray-500">
            {loading ? t('common.loading') : t('bot.chat')}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('bot.create')}</h2>
            <input
              data-testid="bot-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('bot.name')}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
            />
            <input
              data-testid="bot-role-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t('bot.role')}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
            />
            <textarea
              data-testid="bot-instructions-input"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t('bot.instructions')}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
            />
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg border">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="bot-create-submit"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChatArea: React.FC<{ botId: string }> = ({ botId }) => {
  const { t } = useTranslation();
  const { getChatSession, sendMessage, bots, selectBot, error } = useAppStore();
  const [input, setInput] = useState('');

  const session = getChatSession(botId);
  const bot = bots.find((b) => b.id === botId);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) {
      void selectBot(botId);
    }
  }, [botId, session, selectBot]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(botId, input);
    setInput('');
  };

  if (!session) {
    return (
      <PageStatus
        loading={!error}
        error={error}
        onRetry={() => void selectBot(botId)}
      />
    );
  }

  return (
    <div data-state="ready" className="flex-1 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: bot?.look?.color || '#3b82f6' }}
          >
            {bot?.look?.avatar || '🤖'}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{bot?.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {bot?.model?.provider}/{bot?.model?.modelId}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages.length === 0 && (
          <div data-state="empty" className="text-center text-gray-400 py-8">
            {t('bot.chat')}
          </div>
        )}
        {session.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              {message.content}
              {message.streaming && (
                <span className="inline-block ml-2 animate-pulse">▋</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && void handleSend()}
            placeholder={t('common.send')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled={session.isStreaming}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={session.isStreaming}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {session.isStreaming ? t('bot.streaming') : t('common.send')}
          </button>
        </div>
      </div>
    </div>
  );
};
