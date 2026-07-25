import { error, type RequestHandler } from '@sveltejs/kit';
import { uuidSchema } from '$lib/schemas/common';
import { assertSameOrigin } from '$lib/server/security/origin';
import { streamSinglePhoto } from '$lib/server/storage/uploads';
import { processPhoto } from '$lib/server/storage/photos';

export const POST: RequestHandler = async ({ params, request }) => {
  assertSameOrigin(request);
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) throw error(400, 'Invalid place ID');
  try {
    const staged = await streamSinglePhoto(request);
    const attachment = await processPhoto(id.data, staged);
    return Response.json({ attachment }, { status: 201 });
  } catch (uploadError) {
    return Response.json(
      { error: uploadError instanceof Error ? uploadError.message : 'Photo upload failed' },
      { status: 400 }
    );
  }
};
