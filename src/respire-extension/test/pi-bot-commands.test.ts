import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

describe('pi-bot commands', () => {
  let mockPi: ExtensionAPI;
  let mockCtx: any;
  let registeredCommands: Map<string, Function>;

  beforeEach(() => {
    registeredCommands = new Map();
    
    mockPi = {
      registerCommand: vi.fn((name: string, handler: Function) => {
        registeredCommands.set(name, handler);
      }),
    } as any;

    mockCtx = {
      message: { text: '' },
      ui: {
        notify: vi.fn(),
      },
    };
  });

  it('should register pi-bot command', async () => {
    const { registerPiBotCommands } = await import('../pi-bot-commands.js');
    registerPiBotCommands(mockPi);
    
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      'pi-bot',
      expect.objectContaining({
        description: expect.any(String),
        handler: expect.any(Function),
      })
    );
  });

  it('should handle unknown subcommand', async () => {
    const { registerPiBotCommands } = await import('../pi-bot-commands.js');
    let capturedHandler: any;
    
    mockPi.registerCommand = vi.fn((name: string, config: any) => {
      if (name === 'pi-bot') {
        capturedHandler = config.handler;
      }
    }) as any;
    
    registerPiBotCommands(mockPi);
    
    expect(capturedHandler).toBeDefined();
    
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await capturedHandler('unknown', mockCtx);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown subcommand')
    );
    
    consoleSpy.mockRestore();
  });
});
