import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * @param {{ afterPhase?: (phase: string) => void | Promise<void> }} [options]
 */
export async function activatePendingRestore(options = {}) {
  const databasePath = resolve(process.env.DATABASE_PATH || '/data/database.sqlite');
  const uploadPath = resolve(process.env.UPLOAD_PATH || '/data/uploads');
  const backupPath = resolve(process.env.BACKUP_PATH || '/data/backups');
  const markerPath = join(backupPath, 'restore-pending.json');
  if (!existsSync(markerPath)) return false;

  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  const stageDirectory = resolve(marker.stageDirectory);
  const allowedStageRoot = resolve(backupPath, '.staging') + '/';
  if (
    !stageDirectory.startsWith(allowedStageRoot) ||
    !existsSync(join(stageDirectory, 'database.sqlite'))
  ) {
    throw new Error('Pending restore marker points outside the backup staging directory');
  }
  const rollbackDirectory = join(backupPath, `rollback-${marker.token}`);
  await mkdir(rollbackDirectory, { recursive: true, mode: 0o700 });
  /** @param {string} phase */
  const saveMarker = async (phase) => {
    marker.phase = phase;
    await writeFile(markerPath, JSON.stringify(marker, null, 2), { mode: 0o600 });
    await options.afterPhase?.(phase);
  };

  if (marker.phase === 'pending') {
    if (existsSync(databasePath))
      await rename(databasePath, join(rollbackDirectory, 'database.sqlite'));
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(`${databasePath}${suffix}`)) {
        await rename(
          `${databasePath}${suffix}`,
          join(rollbackDirectory, `database.sqlite${suffix}`)
        );
      }
    }
    await saveMarker('database-backed-up');
  }
  if (marker.phase === 'database-backed-up') {
    if (existsSync(uploadPath)) await rename(uploadPath, join(rollbackDirectory, 'uploads'));
    await saveMarker('uploads-backed-up');
  }
  if (marker.phase === 'uploads-backed-up') {
    await mkdir(dirname(databasePath), { recursive: true, mode: 0o700 });
    await rename(join(stageDirectory, 'database.sqlite'), databasePath);
    await saveMarker('database-activated');
  }
  if (marker.phase === 'database-activated') {
    if (existsSync(join(stageDirectory, 'uploads'))) {
      await rename(join(stageDirectory, 'uploads'), uploadPath);
    } else {
      await mkdir(uploadPath, { recursive: true, mode: 0o700 });
    }
    await saveMarker('uploads-activated');
  }
  if (marker.phase === 'uploads-activated') {
    const database = new DatabaseSync(databasePath);
    try {
      database.exec('PRAGMA foreign_keys = ON');
      database.exec('DELETE FROM auth_sessions');
      const integrity = /** @type {{ integrity_check: string } | undefined} */ (
        database.prepare('PRAGMA integrity_check').get()
      );
      if (!integrity || integrity.integrity_check !== 'ok')
        throw new Error('Activated database failed integrity check');
    } finally {
      database.close();
    }
    await saveMarker('complete');
  }
  await rm(stageDirectory, { recursive: true, force: true });
  await rm(markerPath, { force: true });
  return true;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  activatePendingRestore().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
