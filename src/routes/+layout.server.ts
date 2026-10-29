import type { LayoutServerLoad } from './$types';
import { getPublicConfig } from '#lib/server/config/public.js';

export const load: LayoutServerLoad = ({ locals }) => ({
  config: getPublicConfig(),
  identity: locals.identity
});
