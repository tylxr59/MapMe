import { z } from 'zod';
import { uuidSchema } from './common';

export const tagSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1).max(80)
});

export const tagMergeSchema = z.object({
  sourceId: uuidSchema,
  targetId: uuidSchema
});
