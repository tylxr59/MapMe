import yauzl from 'yauzl';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { activatePendingRestore } from './activate-restore.mjs';

const archivePath = process.argv[3] ? resolve(process.argv[3]) : '';
if (!archivePath) throw new Error('Usage: restore-backup /data/backups/mapme-backup-….zip');
const backupPath = resolve(process.env.BACKUP_PATH || '/data/backups');
const databasePath = resolve(process.env.DATABASE_PATH || '/data/database.sqlite');
const uploadPath = resolve(process.env.UPLOAD_PATH || '/data/uploads');
const maximum = Number(process.env.RESTORE_MAX_SIZE_MB || 2048) * 1024 * 1024;
const token = randomUUID();
const stageDirectory = join(backupPath, '.staging', `restore-${token}`);
const archiveInfo = await stat(archivePath);
if (archiveInfo.size > maximum) throw new Error('Backup archive is too large');
await mkdir(stageDirectory, { recursive: true, mode: 0o700 });
const archiveEntries = new Set();
let activationStarted = false;

const safeName = (name) => {
  if (
    name.startsWith('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.split('/').includes('..') ||
    normalize(name) !== name ||
    (name !== 'manifest.json' &&
      name !== 'database.sqlite' &&
      !/^uploads\/(originals|thumbnails)\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(name))
  ) {
    throw new Error(`Unsafe or unexpected ZIP entry: ${name}`);
  }
};

try {
  await new Promise((resolvePromise, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(error || new Error('Could not open backup'));
      let total = 0;
      let entryCount = 0;
      let failed = false;
      /** @param {unknown} failure */
      const fail = (failure) => {
        if (failed) return;
        failed = true;
        zip.close();
        reject(failure);
      };
      zip.on('error', fail);
      zip.on('end', () => {
        if (!failed) resolvePromise();
      });
      zip.on('entry', (entry) => {
        try {
          entryCount += 1;
          if (entryCount > 100_000) throw new Error('Backup contains too many entries');
          safeName(entry.fileName);
          if (entry.fileName === 'manifest.json' && entry.uncompressedSize > 1024 * 1024) {
            throw new Error('Backup manifest is too large');
          }
          if (archiveEntries.has(entry.fileName))
            throw new Error(`Duplicate entry: ${entry.fileName}`);
          archiveEntries.add(entry.fileName);
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (mode === 0o120000) throw new Error('Symlinks are not permitted');
          total += entry.uncompressedSize;
          if (total > maximum * 2) throw new Error('Expanded backup is too large');
          if (entry.compressedSize && entry.uncompressedSize / entry.compressedSize > 1000) {
            throw new Error('Suspicious ZIP compression ratio');
          }
          const destination = join(stageDirectory, entry.fileName);
          mkdir(dirname(destination), { recursive: true, mode: 0o700 }).then(() => {
            zip.openReadStream(entry, async (streamError, stream) => {
              if (streamError || !stream) return fail(streamError || new Error('ZIP read failed'));
              try {
                await pipeline(stream, createWriteStream(destination, { mode: 0o600 }));
                zip.readEntry();
              } catch (writeError) {
                fail(writeError);
              }
            });
          }, fail);
        } catch (entryError) {
          fail(entryError);
        }
      });
      zip.readEntry();
    });
  });

  const manifest = JSON.parse(await readFile(join(stageDirectory, 'manifest.json'), 'utf8'));
  if (
    manifest.formatVersion !== 1 ||
    typeof manifest.appVersion !== 'string' ||
    !Number.isInteger(manifest.schemaVersion) ||
    manifest.schemaVersion < 1 ||
    typeof manifest.createdAt !== 'string' ||
    manifest.database?.path !== 'database.sqlite' ||
    !Number.isInteger(manifest.database.size) ||
    manifest.database.size < 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.database.sha256) ||
    !Array.isArray(manifest.uploads) ||
    !Number.isInteger(manifest.attachmentCount) ||
    manifest.attachmentCount < 0
  ) {
    throw new Error('Unsupported backup manifest');
  }
  if (
    manifest.uploads.length !== manifest.attachmentCount * 2 ||
    manifest.uploads.some(
      (upload) =>
        !upload ||
        typeof upload !== 'object' ||
        typeof upload.path !== 'string' ||
        !Number.isInteger(upload.size) ||
        upload.size < 1 ||
        !/^[a-f0-9]{64}$/.test(upload.sha256)
    )
  ) {
    throw new Error('Malformed backup upload manifest');
  }
  const uploadPaths = manifest.uploads.map((upload) => upload.path);
  if (new Set(uploadPaths).size !== uploadPaths.length) {
    throw new Error('Backup manifest contains duplicate uploads');
  }
  const expectedEntries = new Set(['manifest.json', 'database.sqlite', ...uploadPaths]);
  if (
    archiveEntries.size !== expectedEntries.size ||
    [...archiveEntries].some((entry) => !expectedEntries.has(entry))
  ) {
    throw new Error('Backup entries do not match the manifest');
  }
  const migrationsPath = resolve(
    process.env.MIGRATIONS_PATH || resolve(process.cwd(), 'migrations')
  );
  const currentSchemaVersion = (await readdir(migrationsPath)).filter((name) =>
    /^\d{3}_[a-z0-9_]+\.sql$/.test(name)
  ).length;
  if (manifest.schemaVersion > currentSchemaVersion) {
    throw new Error('Backup uses a newer unsupported database schema');
  }
  const hashFile = async (path) => {
    const hash = createHash('sha256');
    await pipeline(createReadStream(path), hash);
    return hash.digest('hex');
  };
  const stagedDatabasePath = join(stageDirectory, 'database.sqlite');
  const databaseInfo = await stat(stagedDatabasePath);
  if (
    databaseInfo.size !== manifest.database.size ||
    (await hashFile(stagedDatabasePath)) !== manifest.database.sha256
  ) {
    throw new Error('Database checksum mismatch');
  }
  for (const upload of manifest.uploads) {
    safeName(upload.path);
    const path = join(stageDirectory, upload.path);
    const info = await stat(path);
    if (info.size !== upload.size || (await hashFile(path)) !== upload.sha256) {
      throw new Error(`Upload checksum mismatch: ${upload.path}`);
    }
  }
  const database = new DatabaseSync(stagedDatabasePath, { readOnly: true });
  const integrity = database.prepare('PRAGMA integrity_check').get();
  const foreignKeys = database.prepare('PRAGMA foreign_key_check').all();
  const schema = database
    .prepare('SELECT coalesce(max(version), 0) AS version FROM schema_migrations')
    .get();
  const attachments = database
    .prepare('SELECT storage_name, thumbnail_storage_name FROM attachments ORDER BY id')
    .all();
  database.close();
  const databaseUploads = new Set(
    attachments.flatMap((attachment) => [
      `uploads/originals/${attachment.storage_name}`,
      `uploads/thumbnails/${attachment.thumbnail_storage_name}`
    ])
  );
  if (
    integrity.integrity_check !== 'ok' ||
    foreignKeys.length ||
    schema.version !== manifest.schemaVersion ||
    attachments.length !== manifest.attachmentCount ||
    databaseUploads.size !== uploadPaths.length ||
    [...databaseUploads].some((path) => !uploadPaths.includes(path))
  ) {
    throw new Error('Backup database failed integrity checks');
  }
  await writeFile(
    join(backupPath, 'restore-pending.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        token,
        stageDirectory,
        databasePath,
        uploadPath,
        backupPath,
        rollbackBackup: null,
        phase: 'pending',
        createdAt: new Date().toISOString()
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  activationStarted = true;
  await activatePendingRestore();
  console.log('Backup restored successfully. Start the normal MapMe container.');
} catch (error) {
  if (!activationStarted) await rm(stageDirectory, { recursive: true, force: true });
  throw error;
}
