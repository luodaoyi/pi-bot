import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/stores';
import type { Bot, Message } from '@/types';
import { BotFormModal } from '@/components/BotFormModal';
import { createApiClient } from '@/api';

const api = createApiClient();

export const BotsView: React.FC = () => {
  const { t } = useTranslation();
  const { bots, loadBots, selectBot, selectedBotId } = useAppStore();
  const [showBotModal, setShowBotModal] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | undefined>(undefined);

  useEffect(() => {
    loadBots();
  }, []);

  const handleCreateBot = () => {
    setEditingBot(undefined);
    setShowBotModal(true);
  };

  const handleEditBot = (bot: Bot, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBot(bot);
    setShowBotModal(true);
  };

  const handleDeleteBot = async (bot: Bot, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`${t('common.delete')} "${bot.name}"?`)) return;
    try {
      await api.deleteBot(bot.id);
      await loadBots();
    } catch (error) {
      console.error('Failed to delete bot:', error);
    }
  };

  const handleBotSuccess = async () => {
    await loadBots();
  };

  return (
    <div className="h-full flex">
      {/* Bot List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCreateBot}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('bot.create')}
          </button>
        </div>

        <div className="overflow-y-auto">
          {bots.map((bot) => (
            <div
              key={bot.id}
              onClick={() => selectBot(bot.id)}
              className={`
                w-full p-4 border-b border-gray-200 dark:border-gray-700
                transition-colors cursor-pointer
                ${selectedBotId === bot.id
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: bot.color || '#3b82f6' }}
                >
                  {bot.avatar || '🤖'}
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
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleEditBot(bot, e)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title={t('bot.edit')}
                  >
                    <Edit size={16} />
                  </button>
                  {!bot.isMain && (
                    <button
                      onClick={(e) => handleDeleteBot(bot, e)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
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

      <BotFormModal
        bot={editingBot}
        isOpen={showBotModal}
        onClose={() => setShowBotModal(false)}
        onSuccess={handleBotSuccess}
      />
    </div>
  );
};

const MessageCard: React.FC<{ message: Message; bots: Bot[] }> = ({ message, bots }) => {
  const [expandedHops, setExpandedHops] = useState<Set<number>>(new Set());

  const toggleHop = (index: number) => {
    setExpandedHops(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getBotName = (botId: string) => {
    return bots.find(b => b.id === botId)?.name || botId;
  };

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-2xl space-y-2">
        <div
          className={`px-4 py-2 rounded-lg ${
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

        {/* Inter-bot message hops */}
        {message.metadata?.hops && message.metadata.hops.length > 0 && (
          <div className="space-y-1">
            {message.metadata.hops.map((hop, index) => (
              <div
                key={index}
                className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <button
                  onClick={() => toggleHop(index)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
                >
                  <span>
                    {hop.direction === 'outgoing' ? '→' : '←'} {hop.direction === 'outgoing' ? 'Message to' : 'Reply from'} {getBotName(hop.botId)}
                  </span>
                  {expandedHops.has(index) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedHops.has(index) && (
                  <div className="px-3 pb-3 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {hop.content}
                  </div>
                )}
              </div>
            ))}
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
            style={{ backgroundColor: bot?.color || '#3b82f6' }}
          >
            {bot?.avatar || '🤖'}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{bot?.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{bot?.model}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages.map((message) => (
          <MessageCard key={message.id} message={message} bots={bots} />
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
