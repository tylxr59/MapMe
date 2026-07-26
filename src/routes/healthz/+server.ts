import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { RequestHandler } from './$types';
import { databaseHealth } from '$lib/server/db/driver';
import { storagePaths } from '$lib/server/storage/paths';
import { appVersion } from '$lib/server/config/public';

export const GET: RequestHandler = async () => {
  try {
    const health = databaseHealth();
    await Promise.all([
      access(storagePaths.uploads, constants.W_OK),
      access(storagePaths.backups, constants.W_OK)
    ]);
    return Response.json(
      {
        status: 'ok',
        version: appVersion,
        schemaVersion: health.schemaVersion
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch {
    return Response.json(
      { status: 'unhealthy', version: appVersion },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    );
  }
};
