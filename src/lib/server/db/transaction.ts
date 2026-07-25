import type { DatabaseSync } from 'node:sqlite';
import { getDatabase } from './driver';

export function transaction<T>(operation: (database: DatabaseSync) => T): T {
  const database = getDatabase();
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation(database);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw error;
  }
}
