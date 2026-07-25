import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { tagMergeSchema, tagSchema } from '$lib/schemas/tag';
import { uuidSchema } from '$lib/schemas/common';
import { listTags } from '$lib/server/db/queries/tags';
import { deleteTag, mergeTags, saveTag } from '$lib/server/services/tags';

export const load: PageServerLoad = () => ({ tags: listTags() });

export const actions = {
  save: async ({ request }) => {
    const parsed = tagSchema.safeParse(Object.fromEntries(await request.formData()));
    if (!parsed.success)
      return fail(400, { message: 'Tag names must be between 1 and 80 characters.' });
    try {
      saveTag(parsed.data.name, parsed.data.id);
      return { success: true };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Could not save tag' });
    }
  },
  delete: async ({ request }) => {
    const id = uuidSchema.safeParse((await request.formData()).get('id'));
    if (!id.success) return fail(400, { message: 'Invalid tag.' });
    deleteTag(id.data);
    return { success: true };
  },
  merge: async ({ request }) => {
    const parsed = tagMergeSchema.safeParse(Object.fromEntries(await request.formData()));
    if (!parsed.success) return fail(400, { message: 'Choose two different valid tags.' });
    try {
      mergeTags(parsed.data.sourceId, parsed.data.targetId);
      return { success: true };
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Could not merge tags'
      });
    }
  }
} satisfies Actions;
