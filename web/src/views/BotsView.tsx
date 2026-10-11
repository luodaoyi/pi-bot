import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { useAppStore } from '@/stores';
import { PageStatus } from '@/components/PageStatus';
import { ChatView } from '@/components/chat/ChatView';
import { SessionSidebar } from '@/components/session/SessionSidebar';
import { ModelPicker } from '@/components/models/ModelPicker';
import { ThinkingSelector } from '@/components/models/ThinkingSelector';
import type { ModelRef, ThinkingLevel } from '@/api/types';

export const BotsView: React.FC = () => {
  const { t } = useTranslation();
  const store = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void store.loadBots();
  }, [store.loadBots]);

  const selectedBot = store.bots.find((b) => b.id === store.selectedBotId);

  return (
    <div className="h-full flex">
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
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
        <div className="overflow-y-auto flex-1">
          {store.loading && store.bots.length === 0 ? (
            <div data-state="loading" className="text-center text-gray-500 py-8">{t('common.loading')}</div>
          ) : store.error && store.bots.length === 0 ? (
            <PageStatus loading={false} error={store.error} onRetry={() => void store.loadBots()} />
          ) : store.bots.length === 0 ? (
            <div data-state="empty" className="text-center text-gray-500 py-8">{t('bot.empty')}</div>
          ) : (
            store.bots.map((bot) => (
              <div key={bot.id} className="relative">
                <button
                  type="button"
                  onClick={() => void store.selectBot(bot.id)}
                  data-bot-name={bot.name}
                  className={`w-full p-4 text-left border-b border-gray-200 dark:border-gray-700 ${
                    store.selectedBotId === bot.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
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
                      <div className="text-sm text-gray-500 truncate">{bot.role}</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-700"
                  onClick={() => setEditingId(bot.id)}
                  title={t('bot.edit')}
                >
                  <Pencil size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {store.selectedBotId && (
        <SessionSidebar
          sessions={store.sessions}
          activeId={store.activeSessionId}
          supported={store.sessionsSupported}
          loading={store.sessionLoading}
          error={store.sessionsSupported ? store.error : null}
          onSelect={(id) => void store.selectSession(store.selectedBotId!, id)}
          onCreate={() => void store.newSession(store.selectedBotId!)}
          onRename={(id, name) => void store.renameSession(store.selectedBotId!, id, name)}
          onDelete={(id) => void store.deleteSession(store.selectedBotId!, id)}
          onFork={(id) => {
            const last = store.chat.messages[store.chat.messages.length - 1];
            void store.forkSession(store.selectedBotId!, id, last?.id || 'head');
          }}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {store.selectedBotId ? (
          <ChatView
            bot={selectedBot}
            chat={store.chat}
            models={store.models}
            session={store.sessionDetail}
            loading={store.sessionLoading}
            error={store.error}
            onRetry={() => void store.selectBot(store.selectedBotId!)}
            onSend={(text) => store.sendMessage(store.selectedBotId!, text)}
            onAbort={() => store.abortChat(store.selectedBotId!)}
            onModelChange={(model) => {
              if (store.activeSessionId) {
                void store.setSessionModel(store.selectedBotId!, store.activeSessionId, model);
              } else if (store.selectedBotId) {
                void store.updateBot(store.selectedBotId, { model });
              }
            }}
            onThinkingChange={(thinking) => {
              if (store.activeSessionId) {
                void store.setSessionThinking(store.selectedBotId!, store.activeSessionId, thinking);
              } else if (store.selectedBotId) {
                void store.updateBot(store.selectedBotId, { thinking });
              }
            }}
          />
        ) : (
          <div data-state={store.loading ? 'loading' : 'empty'} className="flex-1 flex items-center justify-center text-gray-500">
            {store.loading ? t('common.loading') : t('bot.chat')}
          </div>
        )}
      </div>

      {showCreateModal && (
        <BotFormModal
          title={t('bot.create')}
          models={store.models}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            await store.createBot(data);
            setShowCreateModal(false);
          }}
        />
      )}
      {editingId && (
        <BotFormModal
          title={t('bot.edit')}
          models={store.models}
          initial={store.bots.find((b) => b.id === editingId)}
          onClose={() => setEditingId(null)}
          onSubmit={async (data) => {
            await store.updateBot(editingId, data);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
};

const BotFormModal: React.FC<{
  title: string;
  models: ReturnType<typeof useAppStore.getState>['models'];
  initial?: { name: string; role: string; instructions: string; model: ModelRef | null; thinking?: ThinkingLevel | null };
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    role: string;
    instructions: string;
    model: ModelRef | null;
    thinking: ThinkingLevel | null;
  }) => Promise<void>;
}> = ({ title, models, initial, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [model, setModel] = useState<ModelRef | null>(initial?.model ?? null);
  const [thinking, setThinking] = useState<ThinkingLevel | null>(initial?.thinking ?? null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
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
        <div>
          <label className="block text-sm mb-1">{t('bot.model')}</label>
          <ModelPicker models={models} value={model} onChange={setModel} testId="bot-model-picker" />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('session.thinking')}</label>
          <ThinkingSelector value={thinking} onChange={setThinking} />
        </div>
        {formError && <p className="text-red-600 text-sm">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border">{t('common.cancel')}</button>
          <button
            type="button"
            data-testid="bot-create-submit"
            onClick={() => {
              if (!name.trim() || !role.trim()) return;
              setSaving(true);
              setFormError(null);
              void onSubmit({
                name: name.trim(),
                role: role.trim(),
                instructions: instructions.trim() || role.trim(),
                model,
                thinking,
              }).catch((err) => {
                setFormError(err instanceof Error ? err.message : t('common.error'));
              }).finally(() => setSaving(false));
            }}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
