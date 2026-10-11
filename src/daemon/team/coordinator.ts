/**
 * Team coordinator: Bot-to-bot messaging and ask_user
 * 
 * Handles:
 * - message_bot tool: Send message from one bot to another
 * - Reply routing: Route replies back to sender or user
 * - Hop limit: Prevent infinite message loops
 * - ask_user: Bot can ask questions that block until answered
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Store } from '../store/index.js';
import type { SessionPool } from '../sessions/index.js';
import type {
  MessageBotRequest,
  MessageBotResponse,
  AskUserRequest,
  AskUserResponse,
  AnswerQuestionRequest,
  PendingQuestion,
  Exchange,
} from './types.js';

const MAX_HOPS = 6;

export class TeamCoordinator extends EventEmitter {
  private store: Store;
  private sessionPool: SessionPool;
  private exchanges = new Map<string, Exchange>();
  private questions = new Map<string, PendingQuestion>();

  constructor(store: Store, sessionPool: SessionPool) {
    super();
    this.store = store;
    this.sessionPool = sessionPool;

    // Listen to session events to route replies
    this.sessionPool.on('message_end', (event) => {
      void this.handleReply(event.botId, event.text);
    });
  }

  /**
   * Send message from one bot to another
   */
  async messageBot(request: MessageBotRequest): Promise<MessageBotResponse> {
    const { from, to, message, replyTo = 'me' } = request;

    // Validate sender
    const senderBot = await this.store.getBot(from);
    if (!senderBot) {
      throw new Error(`Sender bot not found: ${from}`);
    }

    // Validate target
    const targetBot = await this.store.getBot(to);
    if (!targetBot) {
      throw new Error(`Target bot not found: ${to}`);
    }

    // Get current hop count from sender's session
    const senderSession = this.sessionPool.getSessionInfo(from);
    const hop = senderSession ? 0 : 0; // TODO: Track hop in session metadata

    if (hop >= MAX_HOPS) {
      throw new Error(`Message hop limit exceeded: ${hop} >= ${MAX_HOPS}`);
    }

    // Create exchange record
    const exchangeId = `ex-${randomUUID().slice(0, 8)}`;
    const messageId = `msg-${randomUUID().slice(0, 8)}`;

    const exchange: Exchange = {
      id: exchangeId,
      from,
      to,
      message,
      replyTo,
      hop: hop + 1,
      createdAt: Date.now(),
      status: 'pending',
    };

    this.exchanges.set(exchangeId, exchange);

    // Send message to target bot
    try {
      await this.sessionPool.sendMessage(to, message, targetBot, {
        from,
        replyTo,
        hop: hop + 1,
      });

      // Emit event
      this.emit('message_sent', {
        type: 'message_sent',
        exchangeId,
        from,
        to,
        message,
      });

      return { messageId, exchangeId };
    } catch (error) {
      exchange.status = 'failed';
      exchange.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Handle reply from a bot
   */
  private async handleReply(botId: string, text: string): Promise<void> {
    // Find pending exchange where this bot is the target
    const pendingExchange = Array.from(this.exchanges.values()).find(
      (ex) => ex.to === botId && ex.status === 'pending'
    );

    if (!pendingExchange) {
      return; // Not a reply to an exchange
    }

    pendingExchange.reply = text;
    pendingExchange.status = 'completed';

    // Route reply based on replyTo
    if (pendingExchange.replyTo === 'me') {
      // Send reply back to sender
      const senderBot = await this.store.getBot(pendingExchange.from);
      if (senderBot) {
        const replyMessage = `[Reply from ${botId}]\n${text}`;
        await this.sessionPool.sendMessage(
          pendingExchange.from,
          replyMessage,
          senderBot,
          {
            from: botId,
            hop: pendingExchange.hop,
          }
        );
      }
    } else {
      // Route to user (emit event for UI)
      this.emit('reply_to_user', {
        type: 'reply_to_user',
        from: botId,
        originalFrom: pendingExchange.from,
        message: text,
      });
    }
  }

  /**
   * Bot asks user a question (non-blocking)
   */
  async askUser(request: AskUserRequest): Promise<AskUserResponse> {
    const { from, question } = request;

    // Validate bot
    const bot = await this.store.getBot(from);
    if (!bot) {
      throw new Error(`Bot not found: ${from}`);
    }

    const questionId = `q-${randomUUID().slice(0, 8)}`;

    const pendingQuestion: PendingQuestion = {
      id: questionId,
      from,
      question,
      createdAt: Date.now(),
      answered: false,
    };

    this.questions.set(questionId, pendingQuestion);

    // Emit event for UI to show question
    this.emit('question', {
      type: 'question',
      questionId,
      from,
      question,
    });

    return { questionId };
  }

  /**
   * User answers a question
   */
  async answerQuestion(request: AnswerQuestionRequest): Promise<void> {
    const { questionId, answer } = request;

    const question = this.questions.get(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    if (question.answered) {
      throw new Error(`Question already answered: ${questionId}`);
    }

    question.answered = true;

    // Get bot
    const bot = await this.store.getBot(question.from);
    if (!bot) {
      throw new Error(`Bot not found: ${question.from}`);
    }

    // Send answer as user message to the bot
    const formattedAnswer = `[Answer to: ${question.question}]\n${answer}`;
    await this.sessionPool.sendMessage(question.from, formattedAnswer, bot, {
      from: 'user',
    });

    // Clean up old questions after 1 hour
    setTimeout(() => {
      this.questions.delete(questionId);
    }, 60 * 60 * 1000);
  }

  /**
   * List pending questions
   */
  listPendingQuestions(): PendingQuestion[] {
    return Array.from(this.questions.values()).filter((q) => !q.answered);
  }

  /**
   * Get exchange by ID
   */
  getExchange(exchangeId: string): Exchange | null {
    return this.exchanges.get(exchangeId) ?? null;
  }

  /**
   * List recent exchanges
   */
  listExchanges(limit = 50): Exchange[] {
    return Array.from(this.exchanges.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}
