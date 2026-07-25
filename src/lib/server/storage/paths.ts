import { access, chmod, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { privateConfig } from '$lib/server/config/private';

export const storagePaths = Object.freeze({
  database: privateConfig.databasePath,
  uploads: privateConfig.uploadPath,
  originals: join(privateConfig.uploadPath, 'originals'),
  thumbnails: join(privateConfig.uploadPath, 'thumbnails'),
  uploadStaging: join(privateConfig.uploadPath, '.staging'),
  backups: privateConfig.backupPath,
  backupStaging: join(privateConfig.backupPath, '.staging'),
  tileCache: privateConfig.tileCachePath
});

export async function initializeStorage(): Promise<void> {
  const directories = [
    dirname(storagePaths.database),
    storagePaths.uploads,
    storagePaths.originals,
    storagePaths.thumbnails,
    storagePaths.uploadStaging,
    storagePaths.backups,
    storagePaths.backupStaging,
    storagePaths.tileCache
  ];
  for (const directory of directories) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700).catch(() => undefined);
    await access(directory, constants.R_OK | constants.W_OK);
  }
}

export function safeStoragePath(directory: string, name: string): string {
  if (!/^[a-f0-9-]{36}(?:\.[a-z0-9]+)?$/.test(name)) {
    throw new Error('Unsafe storage name');
  }
  return join(directory, name);
}

export async function cleanupStaging(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - olderThanMs;
  for (const directory of [storagePaths.uploadStaging, storagePaths.backupStaging]) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = join(directory, entry.name);
      const info = await stat(path).catch(() => null);
      if (info && info.mtimeMs < cutoff) {
        await rm(path, { recursive: true, force: true });
      }
    }
  }
}
