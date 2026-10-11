/**
 * 原子写入 JSON，避免留下 .tmp 残留
 */
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function atomicWriteJson(filePath: string, data: unknown, mode?: number): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await writeFile(tmpPath, content, { encoding: 'utf-8', mode });

  try {
    await rename(tmpPath, filePath);
  } catch {
    // Windows 上目标已存在时 rename 可能失败，回退为覆盖写入后删除临时文件
    await writeFile(filePath, content, { encoding: 'utf-8', mode });
    try {
      await unlink(tmpPath);
    } catch {
      // 忽略清理失败
    }
  }
}
