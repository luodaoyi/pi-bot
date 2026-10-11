/**
 * Delivery: Interface for sending prompts to bot sessions
 * 
 * This is a simple interface that the session pool will implement.
 * For testing, we provide a mock implementation.
 */

export interface DeliveryOptions {
  onDeliver: (botId: string, prompt: string) => Promise<void>;
}

export class Delivery {
  private onDeliver: (botId: string, prompt: string) => Promise<void>;

  constructor(options: DeliveryOptions) {
    this.onDeliver = options.onDeliver;
  }

  /**
   * Deliver a prompt to a bot session
   */
  async deliver(botId: string, prompt: string): Promise<void> {
    await this.onDeliver(botId, prompt);
  }
}

/**
 * Create a mock delivery for testing
 */
export function createMockDelivery(): Delivery {
  return new Delivery({
    onDeliver: async (botId: string, prompt: string) => {
      console.log(`[MockDelivery] Delivering to bot ${botId}: ${prompt.slice(0, 50)}...`);
    },
  });
}
