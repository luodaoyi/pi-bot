/**
 * Tests for RespireClient behavior with mock HTTP runtime
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RespireClient } from '@pi-bot/respire-client';

describe('RespireClient with mock HTTP runtime', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: RespireClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    client = new RespireClient({
      port: 15169,
      autostart: false,
    });
  });

  describe('Health checks', () => {
    it('should successfully check health when runtime is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          server: 'respire',
          v: 1,
          bin: 'rsrs 2.0.0',
          status: 'ok',
        }),
      });

      const health = await client.health();

      expect(health.bin).toBe('rsrs 2.0.0');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });

    it('should throw error when runtime is down', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(client.health()).rejects.toThrow();
    });

    it('should handle runtime returning error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(client.health()).rejects.toThrow();
    });
  });

  describe('Agent config', () => {
    it('should fetch agent config successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: {
            memory_off: false,
            readonly: false,
            project_base: '/workspace',
          },
        }),
      });

      const config = await client.agentConfig();

      expect(config.memory_off).toBe(false);
      expect(config.readonly).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc'),
        expect.any(Object)
      );
    });

    it('should handle memory_off mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: {
            memory_off: true,
            readonly: false,
          },
        }),
      });

      const config = await client.agentConfig();

      expect(config.memory_off).toBe(true);
    });

    it('should handle readonly mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: {
            memory_off: false,
            readonly: true,
          },
        }),
      });

      const config = await client.agentConfig();

      expect(config.readonly).toBe(true);
    });
  });

  describe('Recall operations', () => {
    it('should perform recall with titles', async () => {
      const mockResults = [
        { title: 'memory-1', score: 0.95, text: 'Some memory content' },
        { title: 'memory-2', score: 0.87, text: 'Another memory' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: mockResults,
        }),
      });

      const results = await client.recall({
        query: 'test query',
        titles: true,
        json: true,
      });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('memory-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle empty recall results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: [],
        }),
      });

      const results = await client.recall({
        query: 'nonexistent query',
        json: true,
      });

      expect(results).toHaveLength(0);
    });

    it('should handle recall failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Recall failed' }),
      });

      await expect(
        client.recall({ query: 'test', json: true })
      ).rejects.toThrow();
    });
  });

  describe('Remember operations', () => {
    it('should store memories successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: { id: 'mem-123' },
        }),
      });

      const result = await client.remember({
        content: 'New memory content',
        title: 'test-memory',
      });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle remember failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Storage failed' }),
      });

      await expect(
        client.remember({ content: 'test', title: 'test' })
      ).rejects.toThrow();
    });
  });

  describe('Runtime down behavior', () => {
    it('should gracefully handle connection refused', async () => {
      mockFetch.mockRejectedValueOnce(
        Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        })
      );

      await expect(client.health()).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(
        Object.assign(new Error('Timeout'), {
          code: 'ETIMEDOUT',
        })
      );

      await expect(client.health()).rejects.toThrow();
    });

    it('should allow operations to fail fast when runtime is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const startTime = Date.now();

      try {
        await client.health();
      } catch {
        // Expected
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('List operations', () => {
    it('should list memories with metadata', async () => {
      const mockMemories = [
        { title: 'mem-1', created: '2024-01-01', size: 100 },
        { title: 'mem-2', created: '2024-01-02', size: 200 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: mockMemories,
        }),
      });

      const memories = await client.list();

      expect(memories).toHaveLength(2);
      expect(memories[0].title).toBe('mem-1');
    });
  });

  describe('Forget operations', () => {
    it('should delete memory by title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          v: 1,
          envelope: true,
        }),
      });

      const result = await client.forget({ title: 'mem-to-delete' });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rpc'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
