import { z } from 'zod';
import { checkboxSchema, dateSchema, httpUrlSchema, nullableText, uuidSchema } from './common';

const finiteCoordinate = z.coerce.number().finite();

export const placeStatusSchema = z.enum(['saved', 'want_to_go', 'visited']);

export const placeInputSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  latitude: finiteCoordinate.min(-90).max(90),
  longitude: finiteCoordinate.min(-180).max(180),
  address: nullableText(500),
  description: nullableText(20_000),
  categoryId: uuidSchema,
  tagIds: z.array(uuidSchema).max(50).default([]),
  status: placeStatusSchema.default('saved'),
  isFavorite: checkboxSchema,
  isArchived: checkboxSchema,
  rating: z
    .union([z.literal(''), z.null(), z.coerce.number().int().min(1).max(5)])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  dateVisited: dateSchema,
  sourceUrl: httpUrlSchema,
  extraProperties: z.record(z.string(), z.unknown()).default({})
});

export const placeIdSchema = z.object({ id: uuidSchema });

export type ValidatedPlaceInput = z.infer<typeof placeInputSchema>;
