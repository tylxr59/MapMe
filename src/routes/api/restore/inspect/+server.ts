import type { RequestHandler } from '@sveltejs/kit';
import { rm } from 'node:fs/promises';
import { assertSameOrigin } from '$lib/server/security/origin';
import { inspectRestore } from '$lib/server/backup/restore';
import { streamRestoreUpload } from '$lib/server/backup/upload';

export const POST: RequestHandler = async ({ request }) => {
  assertSameOrigin(request);
  let upload: Awaited<ReturnType<typeof streamRestoreUpload>> | null = null;
  try {
    upload = await streamRestoreUpload(request);
    const inspection = await inspectRestore(upload.path);
    return Response.json({
      inspection: {
        token: inspection.token,
        manifest: inspection.manifest,
        expiresAt: inspection.expiresAt
      }
    });
  } catch (restoreError) {
    return Response.json(
      { error: restoreError instanceof Error ? restoreError.message : 'Backup inspection failed' },
      { status: 400 }
    );
  } finally {
    if (upload) await rm(upload.path, { force: true }).catch(() => undefined);
  }
};
