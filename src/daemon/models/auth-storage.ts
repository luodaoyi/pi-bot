/**
 * 加载 SDK 内部的 AuthStorage（带 proper-lockfile 文件锁）。
 * 1.1.0 的公开入口只导出 readStoredCredential，写入走这个实现。
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AuthOperationOptions, Credential, CredentialInfo } from '@earendil-works/pi-ai';

export interface PiAuthStorage {
  read(provider: string, options?: AuthOperationOptions): Promise<Credential | undefined>;
  modify(
    provider: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    options?: AuthOperationOptions
  ): Promise<Credential | undefined>;
  delete(provider: string, options?: AuthOperationOptions): Promise<void>;
  list(options?: AuthOperationOptions): Promise<readonly CredentialInfo[]>;
}

interface AuthStorageCtor {
  create(authPath?: string): PiAuthStorage;
}

let cachedCtor: AuthStorageCtor | undefined;

function resolveAuthStorageUrl(): string {
  const entry = import.meta.resolve('@earendil-works/pi-coding-agent');
  return pathToFileURL(join(dirname(fileURLToPath(entry)), 'core/auth-storage.js')).href;
}

export async function loadAuthStorageCtor(): Promise<AuthStorageCtor> {
  if (cachedCtor) return cachedCtor;

  const mod = (await import(resolveAuthStorageUrl())) as { AuthStorage?: AuthStorageCtor };
  if (!mod.AuthStorage?.create) {
    throw new Error('SDK AuthStorage is not available in this pi-coding-agent build');
  }
  cachedCtor = mod.AuthStorage;
  return cachedCtor;
}

export async function createAuthStorage(authPath?: string): Promise<PiAuthStorage> {
  const AuthStorage = await loadAuthStorageCtor();
  return AuthStorage.create(authPath);
}
