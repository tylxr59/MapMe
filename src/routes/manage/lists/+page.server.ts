import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listDeleteSchema, listSchema } from '$lib/schemas/list';
import { listPlaceLists } from '$lib/server/db/queries/lists';
import { deletePlaceList, savePlaceList } from '$lib/server/services/lists';

export const load: PageServerLoad = () => ({ lists: listPlaceLists() });

export const actions = {
  save: async ({ request }) => {
    const form = Object.fromEntries(await request.formData());
    if (!form.id && form.sortOrder === undefined) {
      const lists = listPlaceLists();
      form.sortOrder = String(
        lists.length > 0 ? Math.max(...lists.map((list) => list.sortOrder)) + 10 : 0
      );
    }
    const parsed = listSchema.safeParse(form);
    if (!parsed.success) {
      return fail(400, { message: 'Check the list fields.', issues: parsed.error.issues });
    }
    try {
      savePlaceList(parsed.data);
      return {
        success: true,
        message: parsed.data.id ? 'List changes saved.' : 'List added.'
      };
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Could not save list'
      });
    }
  },
  delete: async ({ request }) => {
    const parsed = listDeleteSchema.safeParse(Object.fromEntries(await request.formData()));
    if (!parsed.success) return fail(400, { message: 'Choose a valid replacement list.' });
    try {
      deletePlaceList(parsed.data.id, parsed.data.replacementId);
      return { success: true, message: 'List deleted and its places reassigned.' };
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Could not delete list'
      });
    }
  }
} satisfies Actions;
