import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { categoryDeleteSchema, categorySchema } from '$lib/schemas/category';
import { listCategories } from '$lib/server/db/queries/categories';
import { deleteCategory, saveCategory } from '$lib/server/services/categories';

export const load: PageServerLoad = () => ({ categories: listCategories() });

export const actions = {
  save: async ({ request }) => {
    const form = Object.fromEntries(await request.formData());
    if (!form.id && form.sortOrder === undefined) {
      const categories = listCategories();
      form.sortOrder = String(
        categories.length > 0
          ? Math.max(...categories.map((category) => category.sortOrder)) + 10
          : 0
      );
    }
    const parsed = categorySchema.safeParse(form);
    if (!parsed.success)
      return fail(400, { message: 'Check the category fields.', issues: parsed.error.issues });
    try {
      saveCategory(parsed.data);
      return {
        success: true,
        message: parsed.data.id ? 'Category changes saved.' : 'Category added.'
      };
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Could not save category'
      });
    }
  },
  delete: async ({ request }) => {
    const parsed = categoryDeleteSchema.safeParse(Object.fromEntries(await request.formData()));
    if (!parsed.success) return fail(400, { message: 'Choose a valid replacement category.' });
    try {
      deleteCategory(parsed.data.id, parsed.data.replacementId);
      return { success: true, message: 'Category deleted and its places reassigned.' };
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Could not delete category'
      });
    }
  }
} satisfies Actions;
