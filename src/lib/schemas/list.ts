import { z } from 'zod';
import { uuidSchema } from './common';

export const listSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().min(-100_000).max(100_000).default(0)
});

export const listDeleteSchema = z.object({
  id: uuidSchema,
  replacementId: uuidSchema
});
