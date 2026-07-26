import type { LayoutServerLoad } from './$types';
import { getPublicConfig } from '$lib/server/config/public';

export const load: LayoutServerLoad = ({ locals }) => ({
  config: getPublicConfig(),
  identity: locals.identity
});
