import { z } from 'zod';
import { checkboxSchema, uuidSchema } from './common';

export const categorySchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1).max(80),
  iconName: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.coerce.number().int().min(-100_000).max(100_000).default(0),
  isSystem: checkboxSchema
});

export const categoryDeleteSchema = z.object({
  id: uuidSchema,
  replacementId: uuidSchema
});
