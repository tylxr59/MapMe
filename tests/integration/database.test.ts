import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
  const savedListId = '00000000-0000-4000-8000-000000000101';
  const wantToGoListId = '00000000-0000-4000-8000-000000000102';

  it('applies the current schema with WAL, FTS5, and seeds', async () => {
    const { initializeStorage } = await import('$lib/server/storage/paths');
    const { getDatabase } = await import('$lib/server/db/driver');
    await initializeStorage();
    const database = getDatabase();
    const version = database
      .prepare('SELECT max(version) AS version FROM schema_migrations')
      .get() as {
      version: number;
    };
    expect(version.version).toBe(3);
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
    expect(
      (database.prepare('SELECT count(*) AS count FROM lists').get() as { count: number }).count
    ).toBe(3);
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

  it('migrates legacy statuses and source URLs into lists and links', async () => {
    const legacyPath = join(directory, 'legacy.sqlite');
    const database = new DatabaseSync(legacyPath);
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT
    `);
    for (const [index, filename] of ['001_initial.sql', '002_remove_place_tags.sql'].entries()) {
      const sql = readFileSync(join(process.cwd(), 'migrations', filename), 'utf8');
      database.exec(sql);
      database
        .prepare(
          'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
        )
        .run(
          index + 1,
          filename,
          createHash('sha256').update(sql).digest('hex'),
          new Date().toISOString()
        );
    }
    database
      .prepare(
        `INSERT INTO places (
          id, name, normalized_name, latitude, longitude, category_id, status, source_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        '10000000-0000-4000-8000-000000000001',
        'Legacy place',
        'legacy place',
        42,
        -71,
        '00000000-0000-4000-8000-000000000008',
        'visited',
        'https://example.com/legacy',
        new Date().toISOString(),
        new Date().toISOString()
      );

    const { migrateDatabase } = await import('$lib/server/db/migrate');
    migrateDatabase(database);
    const migrated = database
      .prepare(
        `SELECT l.name AS list_name, pl.url
         FROM places p
         JOIN lists l ON l.id = p.list_id
         JOIN place_links pl ON pl.place_id = p.id
         WHERE p.id = ?`
      )
      .get('10000000-0000-4000-8000-000000000001') as {
      list_name: string;
      url: string;
    };
    expect(migrated).toEqual({
      list_name: 'Visited',
      url: 'https://example.com/legacy'
    });
    database.close();
  });

  it('creates, renames, and deletes custom lists', async () => {
    const { savePlaceList, deletePlaceList } = await import('$lib/server/services/lists');
    const { listPlaceLists } = await import('$lib/server/db/queries/lists');
    const created = savePlaceList({ name: 'Honeymoon options', sortOrder: 40 });
    expect(listPlaceLists().some((list) => list.name === 'Honeymoon options')).toBe(true);
    savePlaceList({ id: created.id, name: 'Anniversary options', sortOrder: 40 });
    expect(listPlaceLists().some((list) => list.name === 'Anniversary options')).toBe(true);
    deletePlaceList(created.id, savedListId);
    expect(listPlaceLists().some((list) => list.id === created.id)).toBe(false);
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
      listId: wantToGoListId,
      isFavorite: false,
      isArchived: false,
      rating: null,
      dateVisited: null,
      links: [{ title: 'Menu', url: 'https://example.com/menu' }],
      extraProperties: {}
    };
    const created = createPlace(base);
    expect(getPlace(created.id)?.name).toBe('Quiet Coffee');
    const filters = {
      query: 'coffee',
      listIds: [],
      categoryIds: [],
      favorite: null,
      archived: false,
      ratingMin: null,
      sort: 'updated_desc' as const
    };
    expect(listPlaces(filters)).toHaveLength(1);
    updatePlace(created.id, { ...base, name: 'Quiet Cafe' });
    const { setPlaceFavorite } = await import('$lib/server/services/places');
    setPlaceFavorite(created.id, true);
    expect(getPlace(created.id)?.isFavorite).toBe(true);
    updatePlace(created.id, {
      ...base,
      name: 'Quiet Cafe',
      isFavorite: true,
      isArchived: true
    });
    expect(getPlace(created.id)?.list.name).toBe('Want to go');
    expect(getPlace(created.id)?.links).toMatchObject([
      { title: 'Menu', url: 'https://example.com/menu' }
    ]);
    expect(getPlace(created.id)?.isArchived).toBe(true);
    const archiveFilters = { ...filters, query: '' };
    expect(listPlaces(archiveFilters)).toHaveLength(0);
    expect(listPlaces({ ...archiveFilters, archived: true })).toHaveLength(1);
    await deletePlace(created.id);
    expect(getPlace(created.id)).toBeNull();
  });

  it('orders places by favorite, rating, then name', async () => {
    const { createPlace, deletePlace } = await import('$lib/server/services/places');
    const { listPlaces } = await import('$lib/server/db/queries/places');
    const base = {
      latitude: 40.7,
      longitude: -73.9,
      address: null,
      description: null,
      categoryId: '00000000-0000-4000-8000-000000000003',
      listId: savedListId,
      isArchived: false,
      dateVisited: null,
      links: [],
      extraProperties: {}
    };
    const favoriteFiveZulu = createPlace({
      ...base,
      name: 'Zulu Favorite Five',
      isFavorite: true,
      rating: 5
    });
    const favoriteFiveAlpha = createPlace({
      ...base,
      name: 'Alpha Favorite Five',
      isFavorite: true,
      rating: 5
    });
    const favoriteFour = createPlace({
      ...base,
      name: 'Favorite Four',
      isFavorite: true,
      rating: 4
    });
    const regularFive = createPlace({
      ...base,
      name: 'Regular Five',
      isFavorite: false,
      rating: 5
    });
    const regularUnrated = createPlace({
      ...base,
      name: 'Regular Unrated',
      isFavorite: false,
      rating: null
    });
    const filters = {
      query: '',
      listIds: [],
      categoryIds: [],
      favorite: null,
      archived: false,
      ratingMin: null
    };

    expect(listPlaces({ ...filters, sort: 'rating_desc' }).map((place) => place.id)).toEqual([
      favoriteFiveAlpha.id,
      favoriteFiveZulu.id,
      favoriteFour.id,
      regularFive.id,
      regularUnrated.id
    ]);

    for (const place of [
      favoriteFiveZulu,
      favoriteFiveAlpha,
      favoriteFour,
      regularFive,
      regularUnrated
    ]) {
      await deletePlace(place.id);
    }
  });

  it('lists categories alphabetically while keeping Other last', async () => {
    const { listCategories } = await import('$lib/server/db/queries/categories');
    expect(listCategories().map((category) => category.name)).toEqual([
      'Coffee',
      'Entertainment',
      'Hiking',
      'Photography',
      'Restaurant',
      'Scenic',
      'Shopping',
      'Other'
    ]);
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
    expect(created.manifest.schemaVersion).toBe(3);
    const archive = readFileSync(backupPath(created.id));
    const inspection = await inspectRestore(
      new File([archive], created.filename, { type: 'application/zip' })
    );
    expect(inspection.manifest.database.sha256).toBe(created.manifest.database.sha256);
  });
});
