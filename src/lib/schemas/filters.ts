import { z } from 'zod';

const splitCommaList = (value: unknown) =>
  typeof value === 'string' && value
    ? value.split(',').filter(Boolean)
    : Array.isArray(value)
      ? value
      : [];

export const filtersSchema = z.object({
  query: z.string().trim().max(200).catch(''),
  listIds: z.preprocess(splitCommaList, z.array(z.string().uuid())).catch([]),
  categoryIds: z.preprocess(splitCommaList, z.array(z.string().uuid())).catch([]),
  favorite: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? null : value === 'true')),
  archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  ratingMin: z.coerce.number().int().min(1).max(5).nullable().catch(null),
  sort: z.enum(['updated_desc', 'name_asc', 'rating_desc']).catch('updated_desc')
});
