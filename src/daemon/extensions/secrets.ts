/**
 * Secrets extension for pi agent
 * Provides secret management with masking and bash env injection
 */

import { Type } from '@sinclair/typebox';
import type {
  ExtensionAPI,
  BashSpawnContext,
  ToolResultEvent,
  ContextEvent,
  BeforeProviderRequestEvent,
} from '@earendil-works/pi-coding-agent';
import type { SecretsManager } from '../secrets/index.js';

export interface SecretsExtensionOptions {
  secrets: SecretsManager;
  getCurrentBotId: () => string;
  getSecretsSync: () => Record<string, string>;
  onSecretRequest?: (name: string, purpose: string, botId: string) => void;
}

export function createSecretsExtension(options: SecretsExtensionOptions) {
  return (pi: ExtensionAPI) => {
    const { secrets, getCurrentBotId, getSecretsSync, onSecretRequest } = options;

    // request_secret tool
    pi.registerTool({
      name: 'request_secret',
      label: 'Request Secret',
      description:
        'Request a secret value (API key, password, etc). The value will be made available in your bash environment after approval. Values are never shown in chat.',
      parameters: Type.Object({
        name: Type.String({
          description: 'Secret name (will be available as PIBOT_SECRET_<NAME> in bash)',
        }),
        purpose: Type.String({ description: 'Why you need this secret' }),
      }),
      async execute(_id, params) {
        try {
          const botId = getCurrentBotId();

          // Create pending request
          const request = secrets.requestSecret(params.name, params.purpose, botId);

          // Notify the session pool to show approval UI
          if (onSecretRequest) {
            onSecretRequest(request.name, request.purpose, request.botId);
          }

          return {
            content: [
              {
                type: 'text',
                text: `Secret "${params.name}" has been requested. Once approved, it will be available as PIBOT_SECRET_${params.name.toUpperCase()} in your bash environment. The value will never be shown in chat.`,
              },
            ],
            details: undefined,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to request secret: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: undefined,
            isError: true,
          };
        }
      },
    });

    // Mask secrets in tool results
    pi.on('tool_result', (event: ToolResultEvent) => {
      const masked = event.content.map((item) => {
        if (item.type === 'text') {
          return {
            ...item,
            text: secrets.maskSecrets(item.text),
          };
        }
        return item;
      });

      return {
        content: masked,
      };
    });

    // Mask secrets in context messages
    pi.on('context', (event: ContextEvent) => {
      const masked = event.messages.map((msg) => {
        if ('content' in msg && Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((item: any) => {
              if (item.type === 'text' && typeof item.text === 'string') {
                return {
                  ...item,
                  text: secrets.maskSecrets(item.text),
                };
              }
              return item;
            }),
          };
        }
        return msg;
      });

      return {
        messages: masked,
      };
    });

    // Mask secrets in provider requests (final safety net)
    pi.on('before_provider_request', (event: BeforeProviderRequestEvent) => {
      const payload = event.payload as any;
      
      if (payload && typeof payload === 'object') {
        const masked = JSON.parse(secrets.maskSecrets(JSON.stringify(payload)));
        return { payload: masked };
      }

      return {};
    });

    // Inject secrets into bash environment via spawnHook (synchronous)
    return {
      bashSpawnHook: (context: BashSpawnContext): BashSpawnContext => {
        try {
          const secretValues = getSecretsSync();
          const env = { ...context.env };

          // Inject each secret as PIBOT_SECRET_<NAME>
          for (const [name, value] of Object.entries(secretValues)) {
            const envKey = `PIBOT_SECRET_${name.toUpperCase()}`;
            env[envKey] = value;
          }

          return {
            ...context,
            env,
          };
        } catch (error) {
          console.error('Failed to inject secrets:', error);
          return context;
        }
      },
    };
  };
}
