import { DatabaseSync } from 'node:sqlite';
import { chmod, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { privateConfig } from '$lib/server/config/private';
import { migrateDatabase } from './migrate';

let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) return database;

  mkdirSync(dirname(privateConfig.databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(privateConfig.databasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
    timeout: 5000
  });
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');
  (db as DatabaseSync & { enableDefensive?: (active: boolean) => void }).enableDefensive?.(true);

  const fts5 = db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled").get() as {
    enabled: number;
  };
  if (fts5.enabled !== 1) {
    db.close();
    throw new Error('The installed Node.js SQLite build does not include FTS5');
  }

  migrateDatabase(db);
  chmod(privateConfig.databasePath, 0o600, () => undefined);
  database = db;
  return db;
}

export function closeDatabase(): void {
  if (!database) return;
  try {
    database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally {
    database.close();
    database = null;
  }
}

export function databaseHealth(): { schemaVersion: number; sqliteVersion: string } {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT
        (SELECT coalesce(max(version), 0) FROM schema_migrations) AS schema_version,
        sqlite_version() AS sqlite_version`
    )
    .get() as { schema_version: number; sqlite_version: string };
  return { schemaVersion: row.schema_version, sqliteVersion: row.sqlite_version };
}
