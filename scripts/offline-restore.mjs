import yauzl from 'yauzl';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
await mkdir(stageDirectory, { recursive: true, mode: 0o700 });

const safeName = (name) => {
  if (
    name.startsWith('/') ||
    name.includes('\\') ||
    name.split('/').includes('..') ||
    normalize(name) !== name ||
    (name !== 'manifest.json' &&
      name !== 'database.sqlite' &&
      !/^uploads\/(originals|thumbnails)\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(name))
  ) {
    throw new Error(`Unsafe or unexpected ZIP entry: ${name}`);
  }
};

await new Promise((resolvePromise, reject) => {
  yauzl.open(archivePath, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
    if (error || !zip) return reject(error || new Error('Could not open backup'));
    let total = 0;
    const names = new Set();
    zip.on('error', reject);
    zip.on('end', resolvePromise);
    zip.on('entry', (entry) => {
      try {
        safeName(entry.fileName);
        if (names.has(entry.fileName)) throw new Error(`Duplicate entry: ${entry.fileName}`);
        names.add(entry.fileName);
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
            if (streamError || !stream) return reject(streamError || new Error('ZIP read failed'));
            try {
              await pipeline(stream, createWriteStream(destination, { mode: 0o600 }));
              zip.readEntry();
            } catch (writeError) {
              reject(writeError);
            }
          });
        }, reject);
      } catch (entryError) {
        reject(entryError);
      }
    });
    zip.readEntry();
  });
});

const manifest = JSON.parse(await readFile(join(stageDirectory, 'manifest.json'), 'utf8'));
if (manifest.formatVersion !== 1 || manifest.database?.path !== 'database.sqlite') {
  throw new Error('Unsupported backup manifest');
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
database.close();
if (integrity.integrity_check !== 'ok' || foreignKeys.length) {
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
await activatePendingRestore();
console.log('Backup restored successfully. Start the normal MapMe container.');
