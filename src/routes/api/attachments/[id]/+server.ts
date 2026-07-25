import { error, type RequestHandler } from '@sveltejs/kit';
import { uuidSchema } from '$lib/schemas/common';
import { assertSameOrigin } from '$lib/server/security/origin';
import { removePhoto } from '$lib/server/storage/photos';

export const DELETE: RequestHandler = async ({ params, request }) => {
  assertSameOrigin(request);
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) throw error(400, 'Invalid photo ID');
  try {
    await removePhoto(id.data);
    return new Response(null, { status: 204 });
  } catch (removeError) {
    throw error(404, removeError instanceof Error ? removeError.message : 'Photo not found');
  }
};
