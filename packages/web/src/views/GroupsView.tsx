import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Send } from 'lucide-react';
import { createApiClient } from '@/api';
import type { Group, Bot, Message } from '@/types';
import { GroupFormModal } from '@/components/GroupFormModal';

const api = createApiClient();

export const GroupsView: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, botsData] = await Promise.all([
        api.getGroups(),
        api.getBots(),
      ]);
      setGroups(groupsData);
      setBots(botsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateGroup = () => {
    setEditingGroup(undefined);
    setShowGroupModal(true);
  };

  const handleEditGroup = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(group);
    setShowGroupModal(true);
  };

  const handleDeleteGroup = async (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`${t('common.delete')} "${group.name}"?`)) return;
    try {
      await api.deleteGroup(group.id);
      await loadData();
      if (selectedGroupId === group.id) {
        setSelectedGroupId(null);
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const handleGroupSuccess = async () => {
    await loadData();
  };

  return (
    <div className="h-full flex">
      {/* Group List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCreateGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            {t('group.create')}
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">{t('common.loading')}</div>
          ) : groups.length === 0 ? (
            <div className="p-4 text-center text-gray-500">{t('group.noGroups')}</div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`
                  p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors
                  ${selectedGroupId === group.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-2xl flex-shrink-0">
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {group.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {group.members.length} {t('group.members')}
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleEditGroup(group, e)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title={t('group.edit')}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteGroup(group, e)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {group.notice && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">
                    {group.notice}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedGroupId ? (
          <GroupChat
            groupId={selectedGroupId}
            group={groups.find(g => g.id === selectedGroupId)!}
            bots={bots}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {t('group.selectGroup')}
          </div>
        )}
      </div>

      <GroupFormModal
        group={editingGroup}
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSuccess={handleGroupSuccess}
      />
    </div>
  );
};

interface GroupChatProps {
  groupId: string;
  group: Group;
  bots: Bot[];
}

const GroupChat: React.FC<GroupChatProps> = ({ groupId, group, bots }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [mentionMode, setMentionMode] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const memberBots = bots.filter(b => group.members.includes(b.id));

  const loadMessages = async () => {
    try {
      const data = await api.getGroupMessages(groupId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInput(value);

    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionMode(true);
      setMentionSearch(mentionMatch[1]);
      setMentionCursorPos(cursorPos);
    } else {
      setMentionMode(false);
    }
  };

  const insertMention = (bot: Bot) => {
    const beforeMention = input.substring(0, mentionCursorPos - mentionSearch.length - 1);
    const afterMention = input.substring(mentionCursorPos);
    const newValue = beforeMention + `@${bot.name} ` + afterMention;
    setInput(newValue);
    setMentionMode(false);
    inputRef.current?.focus();
  };

  const filteredBots = mentionMode
    ? memberBots.filter(b => b.name.toLowerCase().includes(mentionSearch.toLowerCase()))
    : [];

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    try {
      setIsStreaming(true);
      await api.postToGroup(groupId, input);
      setInput('');
      await loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getBotById = (botId: string) => bots.find(b => b.id === botId);

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-2xl">
            👥
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{group.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {group.members.length} members: {memberBots.map(b => b.name).join(', ')}
            </div>
          </div>
        </div>
        {group.notice && (
          <div className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
            📢 {group.notice}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => {
          const senderBot = message.fromBot ? getBotById(message.fromBot) : null;
          const isPassed = message.metadata?.passed;

          return (
            <div key={message.id} className="flex gap-3">
              {/* Bot Avatar */}
              {senderBot && (
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: senderBot.color || '#3b82f6' }}
                  title={senderBot.name}
                >
                  {senderBot.avatar || '🤖'}
                </div>
              )}
              {!senderBot && message.role === 'user' && (
                <div className="w-8 h-8 rounded bg-gray-500 flex items-center justify-center text-lg flex-shrink-0">
                  👤
                </div>
              )}

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                {senderBot && (
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {senderBot.name}
                    {isPassed && <span className="ml-2 text-xs text-gray-500">[PASS]</span>}
                  </div>
                )}
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {message.content}
                  {message.streaming && (
                    <span className="inline-block ml-2 animate-pulse">▋</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* @mention autocomplete */}
        {mentionMode && filteredBots.length > 0 && (
          <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mention:</div>
            <div className="flex gap-2 flex-wrap">
              {filteredBots.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => insertMention(bot)}
                  className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-sm"
                    style={{ backgroundColor: bot.color || '#3b82f6' }}
                  >
                    {bot.avatar || '🤖'}
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">{bot.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('common.send') + ' (@ to mention)'}
            rows={2}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={18} />
            {isStreaming ? t('bot.streaming') : t('common.send')}
          </button>
        </div>
      </div>
    </>
  );
};
