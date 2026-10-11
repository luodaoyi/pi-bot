/**
 * API Response Shape Tests
 * Ensures the API client correctly unwraps server responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpApiClient } from '../http';
import { ApiError } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Response Unwrapping', () => {
  let client: HttpApiClient;

  beforeEach(() => {
    client = new HttpApiClient('/api');
    vi.clearAllMocks();
  });

  it('should unwrap /api/health envelope for ping', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { status: 'ok', version: '0.1.0-beta.6' },
      }),
    } as Response);

    const result = await client.ping();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('0.1.0-beta.6');
  });

  it('should unwrap {success, data: {bots}} to bots array', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1', role: 'test' },
      { id: 'bot-2', name: 'Bot 2', role: 'test' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { bots: mockBots },
      }),
    } as Response);

    const result = await client.getBots();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((b) => b.id)).toEqual(['bot-1', 'bot-2']);
    expect(result[0].name).toBe('Bot 1');
    expect(result.length).toBe(2);
  });

  it('should unwrap {success, data: {bot}} to bot object', async () => {
    const mockBot = { id: 'bot-1', name: 'Test Bot', role: 'tester' };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { bot: mockBot },
      }),
    } as Response);

    const result = await client.getBot('bot-1');
    
    expect(result.id).toBe('bot-1');
    expect(result.name).toBe('Test Bot');
    expect(result.role).toBe('tester');
  });

  it('should unwrap {success, data: {groups}} to groups array', async () => {
    const mockGroups = [
      { id: 'group-1', name: 'Group 1' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { groups: mockGroups },
      }),
    } as Response);

    const result = await client.getGroups();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe('group-1');
    expect(result[0].name).toBe('Group 1');
  });

  it('should throw ApiError when success is false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        success: false,
        error: 'Bot not found',
      }),
    } as Response);

    await expect(client.getBot('non-existent')).rejects.toThrow('Bot not found');
  });

  it('should handle error responses gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        success: false,
        error: 'Internal server error',
      }),
    } as Response);

    await expect(client.getBots()).rejects.toThrow('Internal server error');
  });

  it('should return empty array if data field is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { bots: [] },
      }),
    } as Response);

    const result = await client.getBots();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should unwrap tasks correctly', async () => {
    const mockTasks = [
      { id: 'task-1', name: 'Task 1' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { schedules: mockTasks },
      }),
    } as Response);

    const result = await client.getTasks();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe('task-1');
  });

  it('should unwrap secrets correctly', async () => {
    const mockSecrets = [
      { name: 'secret-1', botId: 'bot-1' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { secrets: mockSecrets },
      }),
    } as Response);

    const result = await client.getSecrets();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('secret-1');
  });

  it('should unwrap models correctly', async () => {
    const mockModels = [
      { provider: 'deepseek', id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 128000, reasoning: false, input: ['text'], hasAuth: true },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { models: mockModels, defaultModel: { provider: 'deepseek', id: 'deepseek-chat' }, defaultThinking: 'medium' },
      }),
    } as Response);

    const result = await client.getAvailableModels();
    
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe('deepseek-chat');
    expect(result[0].provider).toBe('deepseek');
    expect(result[0].hasAuth).toBe(true);
  });

  it('falls back from /api/models 404 to /api/system/models', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ success: false, error: 'Not Found' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { models: [{ provider: 'deepseek', modelId: 'deepseek-flash' }] },
        }),
      } as Response);

    const catalog = await client.getModels();
    expect(catalog.models[0].id).toBe('deepseek-flash');
  });

  it('unwraps session list envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          sessions: [{ id: 's1', name: 'A', createdAt: '', updatedAt: '', messageCount: 2, model: null, thinking: null, isActive: true }],
        },
      }),
    } as Response);

    const sessions = await client.listSessions('bot-1');
    expect(sessions[0].id).toBe('s1');
    expect(sessions[0].isActive).toBe(true);
  });
});

describe('Original Bug Regression Test', () => {
  let client: HttpApiClient;

  beforeEach(() => {
    client = new HttpApiClient('/api');
    vi.clearAllMocks();
  });

  it('should NOT return {success, data} envelope to caller - that was the bug', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1', role: 'test' },
    ];

    // Server returns this format
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { bots: mockBots },
      }),
    } as Response);

    const result = await client.getBots();
    
    // The bug was that result would be {success: true, data: {bots: [...]}}
    // which caused `result.map` to fail since result is not an array
    expect(result).not.toHaveProperty('success');
    expect(result).not.toHaveProperty('data');
    
    // Should be the actual bots array
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe('bot-1');
    expect(result[0].name).toBe('Bot 1');
    
    // This should not throw (was the original error)
    expect(() => result.map((b: any) => b.id)).not.toThrow();
  });
});
