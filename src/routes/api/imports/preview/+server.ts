import { error, type RequestHandler } from '@sveltejs/kit';
import { privateConfig } from '$lib/server/config/private';
import { stageImport } from '$lib/server/import/common';
import { assertSameOrigin } from '$lib/server/security/origin';

export const POST: RequestHandler = async ({ request }) => {
  assertSameOrigin(request);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw error(400, 'Choose an import file');
  if (file.size > privateConfig.importMaxSizeMb * 1024 * 1024) {
    throw error(413, `Import exceeds ${privateConfig.importMaxSizeMb} MiB`);
  }
  try {
    return Response.json({ preview: await stageImport(file) }, { status: 201 });
  } catch (importError) {
    return Response.json(
      { error: importError instanceof Error ? importError.message : 'Import could not be parsed' },
      { status: 400 }
    );
  }
};
