import yauzl from 'yauzl';
import { z } from 'zod';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { BackupManifest } from '$lib/types';
import { privateConfig } from '$lib/server/config/private';
import { databaseHealth } from '$lib/server/db/driver';
import { storagePaths } from '$lib/server/storage/paths';
import { createBackup } from './create';

interface RestoreInspection {
  token: string;
  manifest: BackupManifest;
  stageDirectory: string;
  expiresAt: string;
}

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const uploadPathSchema = z
  .string()
  .regex(/^uploads\/(originals|thumbnails)\/[a-f0-9-]{36}\.[a-z0-9]+$/);
const backupManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    appVersion: z.string().min(1).max(100),
    schemaVersion: z.number().int().min(1),
    createdAt: z.string().datetime(),
    database: z.object({
      path: z.literal('database.sqlite'),
      size: z.number().int().positive(),
      sha256: sha256Schema
    }),
    uploads: z
      .array(
        z.object({
          path: uploadPathSchema,
          size: z.number().int().positive(),
          sha256: sha256Schema
        })
      )
      .max(100_000),
    attachmentCount: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((manifest, context) => {
    const paths = manifest.uploads.map((upload) => upload.path);
    if (new Set(paths).size !== paths.length) {
      context.addIssue({ code: 'custom', path: ['uploads'], message: 'Duplicate upload paths' });
    }
    if (manifest.uploads.length !== manifest.attachmentCount * 2) {
      context.addIssue({
        code: 'custom',
        path: ['attachmentCount'],
        message: 'Attachment count does not match upload entries'
      });
    }
  });

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

function validateEntryName(name: string): void {
  if (
    name.startsWith('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.split('/').includes('..') ||
    posix.normalize(name) !== name
  ) {
    throw new Error(`Unsafe ZIP entry: ${name}`);
  }
  if (
    name !== 'manifest.json' &&
    name !== 'database.sqlite' &&
    !/^uploads\/(originals|thumbnails)\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(name)
  ) {
    throw new Error(`Unexpected backup entry: ${name}`);
  }
}

function extractZip(archivePath: string, directory: string): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      archivePath,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
      (openError, zip) => {
        if (openError || !zip) return reject(openError ?? new Error('Could not open ZIP'));
        let entries = 0;
        let totalBytes = 0;
        const names = new Set<string>();
        let failed = false;
        const fail = (error: Error) => {
          if (failed) return;
          failed = true;
          zip.close();
          reject(error);
        };
        zip.on('error', fail);
        zip.on('end', () => {
          if (!failed) resolve(names);
        });
        zip.on('entry', async (entry) => {
          try {
            entries++;
            if (entries > 100_000) throw new Error('Backup contains too many entries');
            validateEntryName(entry.fileName);
            if (entry.fileName === 'manifest.json' && entry.uncompressedSize > 1024 * 1024) {
              throw new Error('Backup manifest is too large');
            }
            if (names.has(entry.fileName))
              throw new Error(`Duplicate ZIP entry: ${entry.fileName}`);
            names.add(entry.fileName);
            const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
            if (unixMode === 0o120000) throw new Error('Backup symlinks are not allowed');
            totalBytes += entry.uncompressedSize;
            if (totalBytes > privateConfig.restoreMaxSizeMb * 2 * 1024 * 1024) {
              throw new Error('Expanded backup exceeds the configured limit');
            }
            if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > 1000) {
              throw new Error('Suspicious ZIP compression ratio');
            }
            const destination = join(directory, entry.fileName);
            await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
            zip.openReadStream(entry, async (streamError, stream) => {
              if (streamError || !stream) return fail(streamError ?? new Error('ZIP read failed'));
              try {
                await pipeline(stream, createWriteStream(destination, { mode: 0o600 }));
                zip.readEntry();
              } catch (error) {
                fail(error instanceof Error ? error : new Error('ZIP extraction failed'));
              }
            });
          } catch (error) {
            fail(error instanceof Error ? error : new Error('Invalid backup'));
          }
        });
        zip.readEntry();
      }
    );
  });
}

function validateManifest(value: unknown): BackupManifest {
  const parsed = backupManifestSchema.safeParse(value);
  if (!parsed.success) throw new Error('Unsupported or malformed backup manifest');
  return parsed.data;
}

export async function inspectRestore(archivePath: string): Promise<RestoreInspection> {
  const archiveInfo = await stat(archivePath);
  if (archiveInfo.size > privateConfig.restoreMaxSizeMb * 1024 * 1024) {
    throw new Error(`Backup exceeds ${privateConfig.restoreMaxSizeMb} MiB`);
  }
  const token = randomUUID();
  const stageDirectory = join(storagePaths.backupStaging, `restore-${token}`);
  await mkdir(stageDirectory, { recursive: true, mode: 0o700 });
  try {
    const archiveEntries = await extractZip(archivePath, stageDirectory);
    const manifest = validateManifest(
      JSON.parse(await readFile(join(stageDirectory, 'manifest.json'), 'utf8'))
    );
    const expectedEntries = new Set([
      'manifest.json',
      'database.sqlite',
      ...manifest.uploads.map((upload) => upload.path)
    ]);
    if (
      archiveEntries.size !== expectedEntries.size ||
      [...archiveEntries].some((entry) => !expectedEntries.has(entry))
    ) {
      throw new Error('Backup entries do not match the manifest');
    }
    if (manifest.schemaVersion > databaseHealth().schemaVersion) {
      throw new Error('This backup was created by a newer, unsupported MapMe schema');
    }
    const databasePath = join(stageDirectory, 'database.sqlite');
    const databaseInfo = await stat(databasePath);
    if (
      databaseInfo.size !== manifest.database.size ||
      (await sha256File(databasePath)) !== manifest.database.sha256
    ) {
      throw new Error('Backup database checksum does not match the manifest');
    }
    const stagedDatabase = new DatabaseSync(databasePath, {
      readOnly: true,
      enableForeignKeyConstraints: true
    });
    try {
      const integrity = stagedDatabase.prepare('PRAGMA integrity_check').get() as {
        integrity_check: string;
      };
      const foreignKeys = stagedDatabase.prepare('PRAGMA foreign_key_check').all();
      const schema = stagedDatabase
        .prepare('SELECT coalesce(max(version), 0) AS version FROM schema_migrations')
        .get() as { version: number };
      if (
        integrity.integrity_check !== 'ok' ||
        foreignKeys.length > 0 ||
        schema.version !== manifest.schemaVersion
      ) {
        throw new Error('Backup database failed integrity checks');
      }
      const attachments = stagedDatabase
        .prepare('SELECT storage_name, thumbnail_storage_name FROM attachments ORDER BY id')
        .all() as unknown as Array<{
        storage_name: string;
        thumbnail_storage_name: string;
      }>;
      const databaseUploads = new Set(
        attachments.flatMap((attachment) => [
          `uploads/originals/${attachment.storage_name}`,
          `uploads/thumbnails/${attachment.thumbnail_storage_name}`
        ])
      );
      const manifestUploads = new Set(manifest.uploads.map((upload) => upload.path));
      if (
        attachments.length !== manifest.attachmentCount ||
        databaseUploads.size !== manifestUploads.size ||
        [...databaseUploads].some((path) => !manifestUploads.has(path))
      ) {
        throw new Error('Backup attachments do not match the manifest');
      }
    } finally {
      stagedDatabase.close();
    }
    for (const upload of manifest.uploads) {
      validateEntryName(upload.path);
      const path = join(stageDirectory, upload.path);
      const info = await stat(path);
      if (info.size !== upload.size || (await sha256File(path)) !== upload.sha256) {
        throw new Error(`Upload checksum does not match: ${upload.path}`);
      }
    }
    const inspection = {
      token,
      manifest,
      stageDirectory,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString()
    };
    await writeFile(join(stageDirectory, 'inspection.json'), JSON.stringify(inspection), {
      mode: 0o600
    });
    return inspection;
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function confirmRestore(token: string): Promise<{ rollbackBackup: string }> {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('Invalid restore token');
  const stageDirectory = join(storagePaths.backupStaging, `restore-${token}`);
  const inspection = JSON.parse(
    await readFile(join(stageDirectory, 'inspection.json'), 'utf8')
  ) as RestoreInspection;
  if (
    inspection.token !== token ||
    inspection.stageDirectory !== stageDirectory ||
    new Date(inspection.expiresAt).getTime() < Date.now()
  ) {
    throw new Error('Restore inspection is invalid or expired');
  }
  const rollback = await createBackup();
  const marker = {
    formatVersion: 1,
    token,
    stageDirectory,
    databasePath: privateConfig.databasePath,
    uploadPath: privateConfig.uploadPath,
    backupPath: privateConfig.backupPath,
    rollbackBackup: rollback.filename,
    phase: 'pending',
    createdAt: new Date().toISOString()
  };
  const temporary = join(storagePaths.backups, 'restore-pending.json.partial');
  await writeFile(temporary, JSON.stringify(marker, null, 2), { mode: 0o600 });
  await rename(temporary, join(storagePaths.backups, 'restore-pending.json'));
  return { rollbackBackup: rollback.filename };
}
