/**
 * Unit tests for RespireClient
 * These tests use mocked HTTP responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RespireClient } from './client.js';
import { RespireError } from './errors.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('RespireClient', () => {
  let client: RespireClient;

  beforeEach(() => {
    client = new RespireClient({ port: 15169, autostart: false });
    vi.clearAllMocks();
  });

  describe('health', () => {
    it('should return health response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          server: 'respire',
          bin: '1.0.12',
          pid: 1234,
          v: 1,
          url: 'http://127.0.0.1:15169',
          exe: '/usr/local/bin/rsrs',
          data_dir: '/home/user/.rsrs',
        }),
      });

      const health = await client.health();
      expect(health.server).toBe('respire');
      expect(health.v).toBe(1);
    });

    it('should throw on protocol mismatch', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          server: 'respire',
          v: 2, // Wrong version
        }),
      });

      await expect(client.health()).rejects.toThrow(RespireError);
    });
  });

  describe('exec', () => {
    it('should execute CLI command', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          id: 'test-id',
          ok: true,
          exit: 0,
          bin: '1.0.12',
          envelope: {
            command: 'status',
            status: 'ok',
            summary: { test: 'data' },
          },
        }),
      });

      const response = await client.exec(['status']);
      expect(response.envelope?.status).toBe('ok');
    });
  });

  describe('recall', () => {
    it('should recall memories with titles', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          id: 'test-id',
          ok: true,
          exit: 0,
          bin: '1.0.12',
          envelope: {
            command: 'recall',
            status: 'ok',
            summary: {
              count: 2,
              limit: 20,
            },
            details: [
              { id: 'id1', title: 'Memory 1', score: 0.95 },
              { id: 'id2', title: 'Memory 2', score: 0.85 },
            ],
          },
        }),
      });

      const result = await client.recall('test query', { titles: true, limit: 20 });
      expect(result.count).toBe(2);
      expect(result.details).toHaveLength(2);
      expect(result.details[0]?.id).toBe('id1');
    });

    it('should handle empty recall results', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          id: 'test-id',
          ok: true,
          exit: 0,
          bin: '1.0.12',
          envelope: {
            command: 'recall',
            status: 'skip',
          },
        }),
      });

      const result = await client.recall('nonexistent');
      expect(result.count).toBe(0);
      expect(result.details).toHaveLength(0);
    });
  });

  describe('remember', () => {
    it('should store memory', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          id: 'test-id',
          ok: true,
          exit: 0,
          bin: '1.0.12',
          envelope: {
            command: 'remember',
            status: 'ok',
            summary: {
              id: 'mem-123',
              message: 'Stored',
            },
          },
        }),
      });

      const result = await client.remember('Test memory', {
        title: 'Test',
        importance: 'important',
      });
      expect(result.id).toBe('mem-123');
    });

    it('should return candidates on duplicate', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          id: 'test-id',
          ok: true,
          exit: 0,
          bin: '1.0.12',
          envelope: {
            command: 'remember',
            status: 'warn',
            summary: {
              message: 'Similar entries found',
            },
            details: {
              candidates: [{ id: 'existing-1', content: 'Similar content' }],
            },
          },
        }),
      });

      const result = await client.remember('Duplicate memory');
      expect(result.id).toBeUndefined();
      expect(result.candidates).toHaveLength(1);
    });
  });
});
