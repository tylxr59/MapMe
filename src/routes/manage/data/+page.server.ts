import type { PageServerLoad } from './$types';
import { listBackups } from '#lib/server/backup/create.js';
import { privateConfig } from '#lib/server/config/private.js';
import { getAppConfig } from '#lib/server/config/app.js';

export const load: PageServerLoad = async () => ({
  backups: await listBackups(),
  authMode: getAppConfig()?.authMode ?? 'none',
  importMaxSizeMb: privateConfig.importMaxSizeMb,
  restoreMaxSizeMb: privateConfig.restoreMaxSizeMb
});
