import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores';
import type { Bot } from '@/types';

export const BotsView: React.FC = () => {
  const { t } = useTranslation();
  const { bots, loadBots, selectBot, selectedBotId } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadBots();
  }, []);

  return (
    <div className="h-full flex">
      {/* Bot List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('bot.create')}
          </button>
        </div>

        <div className="overflow-y-auto">
          {bots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => selectBot(bot.id)}
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
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedBotId ? (
          <ChatArea botId={selectedBotId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {t('bot.chat')}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatArea: React.FC<{ botId: string }> = ({ botId }) => {
  const { t } = useTranslation();
  const { getChatSession, sendMessage, bots } = useAppStore();
  const [input, setInput] = useState('');
  
  const session = getChatSession(botId);
  const bot = bots.find(b => b.id === botId);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    await sendMessage(botId, input);
    setInput('');
  };

  if (!session) {
    return <div className="flex-1 flex items-center justify-center">{t('common.loading')}</div>;
  }

  return (
    <>
      {/* Header */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('common.send')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled={session.isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={session.isStreaming}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {session.isStreaming ? t('bot.streaming') : t('common.send')}
          </button>
        </div>
      </div>
    </>
  );
};
