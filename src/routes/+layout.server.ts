import type { LayoutServerLoad } from './$types';
import { publicConfig } from '$lib/server/config/public';

export const load: LayoutServerLoad = ({ locals }) => ({
  config: publicConfig,
  identity: locals.identity
});
