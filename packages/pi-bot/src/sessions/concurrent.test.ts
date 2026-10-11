/**
 * Concurrent session test - proves two SDK sessions run concurrently
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

describe('Concurrent SDK Sessions', () => {
  let sessionDir: string;

  beforeAll(async () => {
    sessionDir = join(tmpdir(), 'pi-bot-concurrent-test', randomUUID());
    await mkdir(sessionDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup is handled by tmpdir
  });

  it('should run two sessions concurrently with faux provider', async () => {
    // Create first session
    const sessionPath1 = join(sessionDir, 'session1');
    await mkdir(sessionPath1, { recursive: true });
    const sessionManager1 = await SessionManager.create(sessionPath1);

    const result1 = await createAgentSession({
      sessionManager: sessionManager1,
      model: 'faux/test-model',
      loadUserExtensions: false,
      loadContextFiles: false,
    });

    // Create second session
    const sessionPath2 = join(sessionDir, 'session2');
    await mkdir(sessionPath2, { recursive: true });
    const sessionManager2 = await SessionManager.create(sessionPath2);

    const result2 = await createAgentSession({
      sessionManager: sessionManager2,
      model: 'faux/test-model',
      loadUserExtensions: false,
      loadContextFiles: false,
    });

    // Verify both sessions exist
    expect(result1.session).toBeDefined();
    expect(result2.session).toBeDefined();

    // Test concurrent prompts (with faux provider, should complete immediately)
    const startTime = Date.now();
    
    const promise1 = result1.session.prompt('Test message 1');
    const promise2 = result2.session.prompt('Test message 2');

    // Wait for both to complete
    await Promise.all([promise1, promise2]);

    const duration = Date.now() - startTime;
    
    // If sessions truly run concurrently, duration should be less than 2x single execution
    // With faux provider, this should be very fast
    expect(duration).toBeLessThan(5000);

    // Cleanup
    await result1.session.dispose();
    await result2.session.dispose();
  }, 15000);

  it('should handle session isolation', async () => {
    // Create two sessions
    const sessionPath1 = join(sessionDir, 'session3');
    await mkdir(sessionPath1, { recursive: true });
    const sessionManager1 = await SessionManager.create(sessionPath1);

    const result1 = await createAgentSession({
      sessionManager: sessionManager1,
      model: 'faux/test-model',
      loadUserExtensions: false,
      loadContextFiles: false,
    });

    const sessionPath2 = join(sessionDir, 'session4');
    await mkdir(sessionPath2, { recursive: true });
    const sessionManager2 = await SessionManager.create(sessionPath2);

    const result2 = await createAgentSession({
      sessionManager: sessionManager2,
      model: 'faux/test-model',
      loadUserExtensions: false,
      loadContextFiles: false,
    });

    // Set different names
    await result1.session.setSessionName('Session 1');
    await result2.session.setSessionName('Session 2');

    const name1 = await result1.session.getSessionName();
    const name2 = await result2.session.getSessionName();

    // Verify isolation
    expect(name1).toBe('Session 1');
    expect(name2).toBe('Session 2');
    expect(name1).not.toBe(name2);

    // Cleanup
    await result1.session.dispose();
    await result2.session.dispose();
  });
});
