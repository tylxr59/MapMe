import { error, type RequestHandler } from '@sveltejs/kit';
import { assertSameOrigin } from '$lib/server/security/origin';
import { inspectRestore } from '$lib/server/backup/restore';

export const POST: RequestHandler = async ({ request }) => {
  assertSameOrigin(request);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw error(400, 'Choose a MapMe backup ZIP');
  try {
    const inspection = await inspectRestore(file);
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
  }
};
