import { error, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { assertSameOrigin } from '$lib/server/security/origin';
import { commitStagedImport } from '$lib/server/import/commit';

const selectionSchema = z.object({
  include: z.array(z.number().int().min(0)).max(10_000),
  copyDuplicates: z.array(z.number().int().min(0)).max(10_000).default([])
});

export const POST: RequestHandler = async ({ params, request }) => {
  assertSameOrigin(request);
  const token = params.token;
  if (!token || !/^[a-f0-9-]{36}$/.test(token)) throw error(400, 'Invalid import token');
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw error(400, 'Invalid import selection');
  try {
    return Response.json(await commitStagedImport(token, parsed.data));
  } catch (importError) {
    return Response.json(
      { error: importError instanceof Error ? importError.message : 'Import failed' },
      { status: 400 }
    );
  }
};
