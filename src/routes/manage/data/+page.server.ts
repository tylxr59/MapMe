import type { PageServerLoad } from './$types';
import { listBackups } from '$lib/server/backup/create';
import { privateConfig } from '$lib/server/config/private';

export const load: PageServerLoad = async () => ({
  backups: await listBackups(),
  authMode: privateConfig.authMode,
  importMaxSizeMb: privateConfig.importMaxSizeMb,
  restoreMaxSizeMb: privateConfig.restoreMaxSizeMb
});
