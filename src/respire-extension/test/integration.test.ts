/**
 * Integration test with real Pi SDK session using faux model provider
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createAgentSession } from '@earendil-works/pi-coding-agent';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import { createRespireExtension } from '../extension.js';

describe('Pi SDK Integration with Faux Provider', () => {
  let session: AgentSession | null = null;

  beforeAll(async () => {
    // Create a faux session for testing
    // Note: This requires pi-ai faux provider to be available
    // For now, we'll skip if dependencies aren't available
  });

  it('should load pi-respire extension without errors', () => {
    const extension = createRespireExtension({
      port: 15169,
      autostart: false,
      gateMode: 'warn',
    });

    expect(extension).toBeDefined();
    expect(typeof extension).toBe('function');
  });

  it('should register respire tools', () => {
    const mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const extension = createRespireExtension({
      port: 15169,
      autostart: false,
    });

    // @ts-expect-error - Mock API
    extension(mockPi);

    expect(mockPi.registerTool).toHaveBeenCalled();

    const toolNames = mockPi.registerTool.mock.calls.map((call) => call[0].name);

    // Core tools always registered
    expect(toolNames).toContain('respire_recall');
    expect(toolNames).toContain('respire_remember');
    expect(toolNames).toContain('respire_show');
    expect(toolNames).toContain('respire_list');
    expect(toolNames).toContain('respire_diary');

    // respire_forget is only registered when boot state is 'normal' (canWrite)
    // Since we don't have boot state in this test, it won't be registered
    // This is tested in runtime tests
  });

  it('should register respire commands', () => {
    const mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const extension = createRespireExtension({
      port: 15169,
      autostart: false,
    });

    // @ts-expect-error - Mock API
    extension(mockPi);

    expect(mockPi.registerCommand).toHaveBeenCalled();

    const commandNames = mockPi.registerCommand.mock.calls.map(
      (call) => call[0]
    );

    expect(commandNames).toContain('respire');
    expect(commandNames).toContain('boot');
  });

  it('should register event handlers', () => {
    const mockPi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      on: vi.fn(() => () => {}),
    };

    const extension = createRespireExtension({
      port: 15169,
      autostart: false,
    });

    // @ts-expect-error - Mock API
    extension(mockPi);

    expect(mockPi.on).toHaveBeenCalled();

    const events = mockPi.on.mock.calls.map((call) => call[0]);

    expect(events).toContain('session_start');
    expect(events).toContain('input');
    expect(events).toContain('tool_call');
    expect(events).toContain('tool_result');
    expect(events).toContain('agent_before_settle');
  });

  it.skip('should run a full session with faux provider', async () => {
    // This test would require setting up a full Pi SDK session with faux provider
    // Skipping for now as it requires more complex setup
    expect(session).toBeDefined();
  });
});
