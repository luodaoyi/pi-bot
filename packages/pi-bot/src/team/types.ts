/**
 * Team types: Bot-to-bot messaging and coordination
 */

export interface MessageBotRequest {
  from: string; // Sender bot ID
  to: string; // Target bot ID
  message: string;
  replyTo?: 'me' | 'user'; // Where to route the reply
}

export interface MessageBotResponse {
  messageId: string;
  exchangeId: string;
}

export interface AskUserRequest {
  from: string; // Bot ID asking the question
  question: string;
}

export interface AskUserResponse {
  questionId: string;
}

export interface AnswerQuestionRequest {
  questionId: string;
  answer: string;
}

export interface PendingQuestion {
  id: string;
  from: string;
  question: string;
  createdAt: number;
  answered: boolean;
}

export interface Exchange {
  id: string;
  from: string;
  to: string;
  message: string;
  replyTo: 'me' | 'user';
  hop: number;
  createdAt: number;
  status: 'pending' | 'completed' | 'failed';
  reply?: string;
  error?: string;
}
