import * as archiverModule from 'archiver';
import type { Archiver, ArchiverOptions } from 'archiver';
import { backup, DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { BackupManifest } from '$lib/types';
import { getDatabase } from '$lib/server/db/driver';
import { storagePaths, safeStoragePath } from '$lib/server/storage/paths';
import { publicConfig } from '$lib/server/config/public';
import { mutationLock } from '$lib/server/mutation-lock';

const ZipArchive = (
  archiverModule as unknown as {
    ZipArchive: new (options?: ArchiverOptions) => Archiver;
  }
).ZipArchive;

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export async function createBackup(): Promise<{
  id: string;
  filename: string;
  manifest: BackupManifest;
}> {
  return mutationLock.runExclusive(async () => {
    const id = randomUUID();
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const filename = `mapme-backup-${timestamp}-${id.slice(0, 8)}.zip`;
    const partialPath = join(storagePaths.backups, `${filename}.partial`);
    const finalPath = join(storagePaths.backups, filename);
    const snapshotPath = join(storagePaths.backupStaging, `${id}.sqlite`);
    try {
      await backup(getDatabase(), snapshotPath, { rate: 100 });
      const snapshot = new DatabaseSync(snapshotPath, { readOnly: true });
      const schema = snapshot
        .prepare('SELECT coalesce(max(version), 0) AS version FROM schema_migrations')
        .get() as { version: number };
      const attachments = snapshot
        .prepare('SELECT storage_name, thumbnail_storage_name FROM attachments ORDER BY id')
        .all() as unknown as Array<{ storage_name: string; thumbnail_storage_name: string }>;
      snapshot.close();
      const uploadPaths: string[] = [];
      for (const attachment of attachments) {
        uploadPaths.push(`uploads/originals/${attachment.storage_name}`);
        uploadPaths.push(`uploads/thumbnails/${attachment.thumbnail_storage_name}`);
      }
      const uploads = [];
      for (const relativePath of uploadPaths) {
        const [, directory, name] = relativePath.split('/');
        const source = safeStoragePath(
          directory === 'originals' ? storagePaths.originals : storagePaths.thumbnails,
          name
        );
        const info = await stat(source);
        uploads.push({ path: relativePath, size: info.size, sha256: await sha256File(source) });
      }
      const databaseInfo = await stat(snapshotPath);
      const manifest: BackupManifest = {
        formatVersion: 1,
        appVersion: publicConfig.appVersion,
        schemaVersion: schema.version,
        createdAt: new Date().toISOString(),
        database: {
          path: 'database.sqlite',
          size: databaseInfo.size,
          sha256: await sha256File(snapshotPath)
        },
        uploads,
        attachmentCount: attachments.length
      };

      const output = createWriteStream(partialPath, { mode: 0o600 });
      const archive = new ZipArchive({ zlib: { level: 6 } });
      const complete = new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
      });
      archive.pipe(output);
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
      archive.file(snapshotPath, { name: 'database.sqlite' });
      for (const upload of uploads) {
        const [, directory, name] = upload.path.split('/');
        archive.file(
          safeStoragePath(
            directory === 'originals' ? storagePaths.originals : storagePaths.thumbnails,
            name
          ),
          { name: upload.path }
        );
      }
      await archive.finalize();
      await complete;
      await rename(partialPath, finalPath);
      return { id: filename, filename, manifest };
    } catch (error) {
      await rm(partialPath, { force: true });
      throw error;
    } finally {
      await rm(snapshotPath, { force: true });
    }
  });
}

export async function listBackups(): Promise<
  Array<{ id: string; filename: string; size: number; createdAt: string }>
> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(storagePaths.backups, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^mapme-backup-[A-Za-z0-9.-]+\.zip$/.test(entry.name)) continue;
    const info = await stat(join(storagePaths.backups, entry.name));
    result.push({
      id: entry.name,
      filename: entry.name,
      size: info.size,
      createdAt: info.mtime.toISOString()
    });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function backupPath(id: string): string {
  if (!/^mapme-backup-[A-Za-z0-9.-]+\.zip$/.test(id) || basename(id) !== id) {
    throw new Error('Invalid backup identifier');
  }
  return join(storagePaths.backups, id);
}
