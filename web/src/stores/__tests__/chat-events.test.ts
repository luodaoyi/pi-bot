import { describe, expect, it } from 'vitest';
import { applyBotEvent, createChatRuntime, hintForChatError } from '../chat-events';

describe('applyBotEvent', () => {
  it('streams thinking, tools and text', () => {
    let state = createChatRuntime();
    state = applyBotEvent(state, { type: 'bot.message_start', botId: 'b', sessionId: 's', runId: 'r', messageId: 'a1' });
    state = applyBotEvent(state, { type: 'bot.thinking_delta', botId: 'b', sessionId: 's', runId: 'r', messageId: 'a1', delta: '想' });
    state = applyBotEvent(state, { type: 'bot.tool_start', botId: 'b', sessionId: 's', runId: 'r', toolCallId: 't1', toolName: 'read', args: { path: 'a' } });
    state = applyBotEvent(state, { type: 'bot.tool_update', botId: 'b', sessionId: 's', runId: 'r', toolCallId: 't1', result: '...' });
    state = applyBotEvent(state, { type: 'bot.tool_end', botId: 'b', sessionId: 's', runId: 'r', toolCallId: 't1', result: 'ok', isError: false });
    state = applyBotEvent(state, { type: 'bot.text_delta', botId: 'b', sessionId: 's', runId: 'r', messageId: 'a1', delta: 'hi' });
    state = applyBotEvent(state, { type: 'bot.turn_end', botId: 'b', sessionId: 's', runId: 'r' });

    const assistant = state.messages[0];
    expect(assistant.thinking).toBe('想');
    expect(assistant.content).toBe('hi');
    expect(assistant.toolCalls?.[0].name).toBe('read');
    expect(assistant.toolCalls?.[0].status).toBe('success');
    expect(state.isStreaming).toBe(false);
  });

  it('keeps user message_start from becoming an assistant bubble', () => {
    let state = createChatRuntime();
    state = applyBotEvent(state, {
      type: 'bot.message_start',
      botId: 'b',
      sessionId: 's',
      runId: 'r',
      role: 'user',
      text: 'hello',
    });
    state = applyBotEvent(state, {
      type: 'bot.message_start',
      botId: 'b',
      sessionId: 's',
      runId: 'r',
      role: 'assistant',
    });
    state = applyBotEvent(state, {
      type: 'bot.text_delta',
      botId: 'b',
      sessionId: 's',
      runId: 'r',
      delta: 'hi',
    });
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('hello');
    expect(state.messages[1].role).toBe('assistant');
    expect(state.messages[1].content).toBe('hi');
  });

  it('marks tool error and message error', () => {
    let state = createChatRuntime();
    state = applyBotEvent(state, { type: 'bot.tool_start', botId: 'b', sessionId: 's', runId: 'r', toolCallId: 't1', toolName: 'bash' });
    state = applyBotEvent(state, { type: 'bot.tool_end', botId: 'b', sessionId: 's', runId: 'r', toolCallId: 't1', isError: true, result: 'boom' });
    state = applyBotEvent(state, { type: 'bot.error', botId: 'b', sessionId: 's', runId: 'r', error: 'No API key found for anthropic.' });
    expect(state.messages[0].toolCalls?.[0].status).toBe('error');
    expect(state.messages[0].error).toContain('anthropic');
    expect(state.isStreaming).toBe(false);
  });
});

describe('hintForChatError', () => {
  it('points to settings when provider has no auth', () => {
    const hint = hintForChatError('No API key found for anthropic.');
    expect(hint?.href).toBe('/settings?tab=providers');
    expect(hint?.text).toContain('anthropic');
  });
});
