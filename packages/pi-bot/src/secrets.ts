import { readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

export interface Secret {
  key: string;
  value: string;
  description?: string;
  created: number;
}

export class SecretsStore {
  private secrets = new Map<string, Secret>();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (!existsSync(this.filePath)) {
      await this.save();
      return;
    }

    const content = await readFile(this.filePath, "utf-8");
    const data = JSON.parse(content) as { secrets: Secret[] };
    
    for (const secret of data.secrets) {
      this.secrets.set(secret.key, secret);
    }
  }

  async save(): Promise<void> {
    const data = {
      secrets: Array.from(this.secrets.values()),
    };
    
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    await chmod(tmpPath, 0o600);
    await writeFile(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
    await chmod(this.filePath, 0o600);
  }

  async set(key: string, value: string, description?: string): Promise<void> {
    this.secrets.set(key, {
      key,
      value,
      description,
      created: Date.now(),
    });
    await this.save();
  }

  get(key: string): string | undefined {
    return this.secrets.get(key)?.value;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.secrets.delete(key);
    if (existed) {
      await this.save();
    }
    return existed;
  }

  list(): Array<{ key: string; description?: string; created: number }> {
    return Array.from(this.secrets.values()).map((s) => ({
      key: s.key,
      description: s.description,
      created: s.created,
    }));
  }

  getEnvVars(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, secret] of this.secrets) {
      env[`PIBOT_SECRET_${key.toUpperCase()}`] = secret.value;
    }
    return env;
  }

  maskValue(text: string): string {
    let masked = text;
    
    for (const secret of this.secrets.values()) {
      if (secret.value.length >= 8) {
        const regex = new RegExp(this.escapeRegex(secret.value), "g");
        masked = masked.replace(regex, `[MASKED:${secret.key}]`);
      }
    }
    
    return masked;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

export function generateSecret(length = 32): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}
