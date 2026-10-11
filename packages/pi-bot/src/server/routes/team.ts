/**
 * Team routes: Bot-to-bot messaging and ask_user
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import type { TeamCoordinator } from '../../team/index.js';
import type {
  MessageBotRequest,
  AskUserRequest,
  AnswerQuestionRequest,
} from '../../team/types.js';

export function setupTeamRoutes(
  app: Hono,
  _store: Store,
  teamCoordinator: TeamCoordinator,
  _config: Config
) {
  /**
   * Send message from one bot to another
   */
  app.post('/api/team/message', async (c) => {
    const body = (await c.req.json()) as MessageBotRequest;

    try {
      const result = await teamCoordinator.messageBot(body);
      return c.json({ success: true, data: result });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send message',
        },
        400
      );
    }
  });

  /**
   * Bot asks user a question
   */
  app.post('/api/team/ask', async (c) => {
    const body = (await c.req.json()) as AskUserRequest;

    try {
      const result = await teamCoordinator.askUser(body);
      return c.json({ success: true, data: result });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to ask question',
        },
        400
      );
    }
  });

  /**
   * User answers a question
   */
  app.post('/api/team/answer', async (c) => {
    const body = (await c.req.json()) as AnswerQuestionRequest;

    try {
      await teamCoordinator.answerQuestion(body);
      return c.json({ success: true, data: { answered: true } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to answer question',
        },
        400
      );
    }
  });

  /**
   * List pending questions
   */
  app.get('/api/team/questions', async (c) => {
    const questions = teamCoordinator.listPendingQuestions();
    return c.json({ success: true, data: { questions } });
  });

  /**
   * List recent exchanges
   */
  app.get('/api/team/exchanges', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const exchanges = teamCoordinator.listExchanges(limit);
    return c.json({ success: true, data: { exchanges } });
  });

  /**
   * Get exchange by ID
   */
  app.get('/api/team/exchanges/:id', async (c) => {
    const exchangeId = c.req.param('id');
    const exchange = teamCoordinator.getExchange(exchangeId);

    if (!exchange) {
      return c.json({ success: false, error: 'Exchange not found' }, 404);
    }

    return c.json({ success: true, data: { exchange } });
  });
}
