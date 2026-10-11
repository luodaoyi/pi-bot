/**
 * 读取本包版本号（兼容 src 与 dist 布局）
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function getPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../package.json'),
    join(here, '../../../package.json'),
    join(here, '../package.json'),
  ];

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as { version?: string };
      if (pkg.version) {
        return pkg.version;
      }
    } catch {
      // 尝试下一个候选路径
    }
  }

  return '0.0.0';
}
