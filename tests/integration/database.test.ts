import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'mapme-test-'));

beforeAll(() => {
  process.env.ORIGIN = 'http://localhost:3000';
  process.env.AUTH_MODE = 'none';
  process.env.DATABASE_PATH = join(directory, 'database.sqlite');
  process.env.UPLOAD_PATH = join(directory, 'uploads');
  process.env.BACKUP_PATH = join(directory, 'backups');
});

afterAll(async () => {
  const { closeDatabase } = await import('$lib/server/db/driver');
  closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe('database and place CRUD', () => {
  it('applies the v1.2 schema with WAL, FTS5, and seeds', async () => {
    const { initializeStorage } = await import('$lib/server/storage/paths');
    const { getDatabase } = await import('$lib/server/db/driver');
    await initializeStorage();
    const database = getDatabase();
    const version = database
      .prepare('SELECT max(version) AS version FROM schema_migrations')
      .get() as {
      version: number;
    };
    expect(version.version).toBe(2);
    expect(
      (database.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode
    ).toBe('wal');
    expect(
      (database.prepare('SELECT count(*) AS count FROM categories').get() as { count: number })
        .count
    ).toBe(8);
    expect(
      (
        database
          .prepare("SELECT icon_name FROM categories WHERE normalized_name = 'other'")
          .get() as { icon_name: string }
      ).icon_name
    ).toBe('pin');
  });

  it('imports v1.0 environment settings into persistent application configuration', async () => {
    const { getAppConfig } = await import('$lib/server/config/app');
    const config = getAppConfig();
    expect(config).toMatchObject({
      version: 1,
      origin: 'http://localhost:3000',
      authMode: 'none'
    });
    const { getDatabase } = await import('$lib/server/db/driver');
    const row = getDatabase()
      .prepare("SELECT value_json FROM settings WHERE key = 'app_configuration'")
      .get() as { value_json: string };
    expect(JSON.parse(row.value_json).origin).toBe('http://localhost:3000');
  });

  it('creates, searches, updates, and deletes a place', async () => {
    const { createPlace, updatePlace, deletePlace } = await import('$lib/server/services/places');
    const { getPlace, listPlaces } = await import('$lib/server/db/queries/places');
    const base = {
      name: 'Quiet Coffee',
      latitude: 40.7,
      longitude: -73.9,
      address: '1 Main Street',
      description: 'Window seat',
      categoryId: '00000000-0000-4000-8000-000000000003',
      status: 'want_to_go' as const,
      isFavorite: false,
      isArchived: false,
      rating: null,
      dateVisited: null,
      sourceUrl: null,
      extraProperties: {}
    };
    const created = createPlace(base);
    expect(getPlace(created.id)?.name).toBe('Quiet Coffee');
    const filters = {
      query: 'coffee',
      statuses: [],
      categoryIds: [],
      visited: 'any' as const,
      favorite: null,
      archived: false,
      ratingMin: null,
      sort: 'updated_desc' as const
    };
    expect(listPlaces(filters)).toHaveLength(1);
    updatePlace(created.id, { ...base, name: 'Quiet Cafe', isFavorite: true });
    expect(getPlace(created.id)?.isFavorite).toBe(true);
    await deletePlace(created.id);
    expect(getPlace(created.id)).toBeNull();
  });

  it('reorders every category as one atomic list', async () => {
    const { listCategories } = await import('$lib/server/db/queries/categories');
    const { reorderCategories } = await import('$lib/server/services/categories');
    const original = listCategories();
    const reversedIds = original.map((category) => category.id).reverse();

    reorderCategories(reversedIds);
    expect(listCategories().map((category) => category.id)).toEqual(reversedIds);
    expect(() => reorderCategories(reversedIds.slice(1))).toThrow('Category order is incomplete');

    reorderCategories(original.map((category) => category.id));
  });

  it('stores only session token hashes and supports revocation', async () => {
    const { getDatabase } = await import('$lib/server/db/driver');
    const { createSession, deleteSession, sha256, validateSession } =
      await import('$lib/server/auth/sessions');
    const passwordHash = '$argon2id$test-fingerprint';
    const session = createSession(passwordHash);
    const stored = getDatabase().prepare('SELECT token_hash FROM auth_sessions').get() as {
      token_hash: string;
    };
    expect(stored.token_hash).toBe(sha256(session.token));
    expect(stored.token_hash).not.toContain(session.token);
    expect(validateSession(session.token, passwordHash)).toBe(true);
    deleteSession(session.token);
    expect(validateSession(session.token, passwordHash)).toBe(false);
  });

  it('creates a consistent backup that passes restore inspection', async () => {
    const { createBackup, backupPath } = await import('$lib/server/backup/create');
    const { inspectRestore } = await import('$lib/server/backup/restore');
    const created = await createBackup();
    expect(created.manifest.schemaVersion).toBe(2);
    const archive = readFileSync(backupPath(created.id));
    const inspection = await inspectRestore(
      new File([archive], created.filename, { type: 'application/zip' })
    );
    expect(inspection.manifest.database.sha256).toBe(created.manifest.database.sha256);
  });
});
