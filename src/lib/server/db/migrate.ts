import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
}

export function migrationsDirectory(): string {
  const candidates = [
    process.env.MIGRATIONS_PATH,
    resolve(process.cwd(), 'migrations'),
    resolve(process.cwd(), '../migrations')
  ].filter((value): value is string => Boolean(value));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Could not locate migrations directory');
  return found;
}

export function migrateDatabase(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);

  const files = readdirSync(migrationsDirectory())
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  if (files.length === 0) throw new Error('No database migrations found');

  const applied = db
    .prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version')
    .all() as unknown as AppliedMigration[];
  const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]));

  for (const [index, file] of files.entries()) {
    const version = Number(file.slice(0, 3));
    if (version !== index + 1) throw new Error(`Migration sequence has a gap at ${file}`);
    const sql = readFileSync(resolve(migrationsDirectory(), file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = appliedByVersion.get(version);
    if (previous) {
      if (previous.name !== file || previous.checksum !== checksum) {
        throw new Error(`Applied migration ${version} no longer matches ${file}`);
      }
      continue;
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
      ).run(version, file, checksum, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed`, { cause: error });
    }
  }

  const foreignKeyProblems = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyProblems.length > 0) {
    throw new Error(`Database foreign key check failed (${foreignKeyProblems.length} problem(s))`);
  }
}
