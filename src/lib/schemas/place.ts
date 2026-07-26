import { z } from 'zod';
import { checkboxSchema, dateSchema, nullableText, uuidSchema } from './common';

const finiteCoordinate = z.coerce.number().finite();

export const placeLinkInputSchema = z.object({
  title: nullableText(200),
  url: z
    .string()
    .trim()
    .min(1, 'Link URL is required')
    .max(2048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Link must be a valid HTTP or HTTPS URL')
});

const placeLinksSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(placeLinkInputSchema).max(50).default([]));

export const placeInputSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  latitude: finiteCoordinate.min(-90).max(90),
  longitude: finiteCoordinate.min(-180).max(180),
  address: nullableText(500),
  description: nullableText(20_000),
  categoryId: uuidSchema,
  listId: uuidSchema,
  isFavorite: checkboxSchema,
  isArchived: checkboxSchema,
  rating: z
    .union([z.literal(''), z.null(), z.coerce.number().int().min(1).max(5)])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  dateVisited: dateSchema,
  links: placeLinksSchema,
  extraProperties: z.record(z.string(), z.unknown()).default({})
});

export const placeIdSchema = z.object({ id: uuidSchema });
export const placeFavoriteSchema = z.object({
  id: uuidSchema,
  isFavorite: checkboxSchema
});

export type ValidatedPlaceInput = z.infer<typeof placeInputSchema>;
