/**
 * Secrets: Secure secret management with masking
 * 
 * Based on DS-Bot secrets.js but adapted for pi SDK
 */

import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  SecretConfig,
  SecretInfo,
  SecretRequestData,
  SecretApprovalRequest,
} from '@pi-bot/shared';

export interface SecretsOptions {
  storePath: string;
}

interface SecretsState {
  secrets: Record<string, SecretConfig>;
}

export class SecretsManager {
  private secrets = new Map<string, SecretConfig>();
  private storePath: string;
  private initialized = false;

  constructor(options: SecretsOptions) {
    this.storePath = options.storePath;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.load();
    this.initialized = true;
  }

  private async load(): Promise<void> {
    try {
      const content = await readFile(this.storePath, 'utf-8');
      const state: SecretsState = JSON.parse(content);

      for (const secret of Object.values(state.secrets)) {
        this.secrets.set(secret.name, secret);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist yet
    }
  }

  private async save(): Promise<void> {
    const state: SecretsState = {
      secrets: Object.fromEntries(this.secrets),
    };

    const dir = join(this.storePath, '..');
    await mkdir(dir, { recursive: true });

    const tmpPath = `${this.storePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');

    // Set 0600 permissions (owner read/write only)
    await chmod(tmpPath, 0o600);

    // Atomic rename
    await writeFile(this.storePath, JSON.stringify(state, null, 2), 'utf-8');
    await chmod(this.storePath, 0o600);
  }

  /**
   * Request a secret (called by bot tool)
   * Returns request data that will be fulfilled by UI
   */
  requestSecret(name: string, purpose: string, botId: string): SecretRequestData {
    return {
      name,
      purpose,
      botId,
    };
  }

  /**
   * Approve/create a secret (called by UI)
   */
  async approveSecret(
    name: string,
    request: SecretApprovalRequest,
    requestedBy: string
  ): Promise<void> {
    const existing = this.secrets.get(name);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing secret
      existing.value = request.value;
      existing.scope = request.scope;
      existing.updatedAt = now;
    } else {
      // Create new secret
      const secret: SecretConfig = {
        name,
        value: request.value,
        purpose: request.name, // Use name as purpose fallback
        scope: request.scope,
        requestedBy,
        createdAt: now,
        updatedAt: now,
      };
      this.secrets.set(name, secret);
    }

    await this.save();
  }

  /**
   * List secrets (without values)
   */
  async list(botId?: string): Promise<SecretInfo[]> {
    const secrets = Array.from(this.secrets.values());
    const filtered = botId
      ? secrets.filter((s) => this.canAccess(s, botId))
      : secrets;

    return filtered.map((s) => this.toInfo(s));
  }

  /**
   * Get secret value if bot has access
   */
  async getValue(name: string, botId: string): Promise<string | null> {
    const secret = this.secrets.get(name);
    if (!secret) return null;

    if (!this.canAccess(secret, botId)) {
      return null;
    }

    // Update last used
    secret.lastUsedAt = new Date().toISOString();
    await this.save();

    return secret.value;
  }

  /**
   * Get all secret values for a bot (for env injection)
   */
  async getValuesForBot(botId: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    for (const [name, secret] of this.secrets) {
      if (this.canAccess(secret, botId)) {
        result[name] = secret.value;
      }
    }

    return result;
  }

  /**
   * Delete a secret
   */
  async delete(name: string): Promise<void> {
    this.secrets.delete(name);
    await this.save();
  }

  /**
   * Check if bot can access secret
   */
  private canAccess(secret: SecretConfig, botId: string): boolean {
    if (secret.scope === 'all') return true;
    if (Array.isArray(secret.scope)) {
      return secret.scope.includes(botId);
    }
    return false;
  }

  /**
   * Convert secret to info (without value)
   */
  private toInfo(secret: SecretConfig): SecretInfo {
    return {
      name: secret.name,
      purpose: secret.purpose,
      scope: secret.scope,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      lastUsedAt: secret.lastUsedAt,
    };
  }

  /**
   * Mask secret values in text
   * Based on DS-Bot redactSecrets logic
   */
  maskSecrets(text: string): string {
    let masked = text;

    for (const secret of this.secrets.values()) {
      const value = secret.value;
      
      // Skip very short values (to avoid false positives)
      if (value.length < 8) {
        // Only mask if surrounded by non-alphanumeric
        const regex = new RegExp(`(?<![a-zA-Z0-9])${this.escapeRegex(value)}(?![a-zA-Z0-9])`, 'g');
        masked = masked.replace(regex, `[secret:${secret.name}]`);
      } else {
        // Mask all occurrences
        masked = masked.replaceAll(value, `[secret:${secret.name}]`);
      }
    }

    return masked;
  }

  /**
   * Check if text looks like a secret (for memory filtering)
   * Based on DS-Bot looksLikeKey and looksSecret
   */
  looksLikeSecret(text: string): boolean {
    // Known key formats
    const keyPatterns = [
      /sk-[a-zA-Z0-9_-]{8,}/, // OpenAI-style keys
      /ghp_[a-zA-Z0-9]{36,}/,
      /AKIA[A-Z0-9]{16}/,
      /xox[abpr]-[a-zA-Z0-9-]{10,}/,
      /AIza[a-zA-Z0-9_-]{35}/,
      /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, // JWT
      /-----BEGIN [A-Z ]+-----/, // PEM
    ];

    for (const pattern of keyPatterns) {
      if (pattern.test(text)) return true;
    }

    // Long mixed alphanumeric strings
    if (/[a-zA-Z0-9]{32,}/.test(text) && /[a-z]/.test(text) && /[A-Z]/.test(text)) {
      return true;
    }

    // Password-like phrases (Chinese and English)
    const secretPhrases = [
      /(密码|口令|验证码|PIN|OTP).{0,5}(是|为|为了|:|=)/i,
      /(password|pin|otp|passcode).{0,5}(is|was|:|=)/i,
      /用.{0,10}当密码/,
      /(身份证|护照|社保|驾照|信用卡).*\d{15,}/,
      /\d{15,}/, // Long numeric strings
    ];

    for (const pattern of secretPhrases) {
      if (pattern.test(text)) return true;
    }

    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get all secret values for masking
   */
  getAllValues(): string[] {
    return Array.from(this.secrets.values()).map((s) => s.value);
  }
}

export async function createSecretsManager(options: SecretsOptions): Promise<SecretsManager> {
  const manager = new SecretsManager(options);
  await manager.init();
  return manager;
}
