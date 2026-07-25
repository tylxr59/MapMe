import type { RequestHandler } from './$types';
import { createBackup, listBackups } from '$lib/server/backup/create';
import { assertSameOrigin } from '$lib/server/security/origin';

export const GET: RequestHandler = async () => Response.json({ backups: await listBackups() });

export const POST: RequestHandler = async ({ request }) => {
  assertSameOrigin(request);
  try {
    return Response.json({ backup: await createBackup() }, { status: 201 });
  } catch (backupError) {
    return Response.json(
      { error: backupError instanceof Error ? backupError.message : 'Backup failed' },
      { status: 500 }
    );
  }
};
