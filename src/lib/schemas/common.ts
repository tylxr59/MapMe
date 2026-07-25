import { z } from 'zod';

export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export const uuidSchema = z.string().uuid();

export const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const checkboxSchema = z
  .union([
    z.boolean(),
    z.literal('on'),
    z.literal('true'),
    z.literal('false'),
    z.literal('1'),
    z.literal('0')
  ])
  .optional()
  .transform((value) => value === true || value === 'on' || value === 'true' || value === '1');

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be a valid HTTP or HTTPS URL')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const dateSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use YYYY-MM-DD')
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    'Invalid date'
  )
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export function formDataObject(form: FormData): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key === 'tagIds') continue;
    object[key] = typeof value === 'string' ? value : value.name;
  }
  object.tagIds = form
    .getAll('tagIds')
    .filter((value): value is string => typeof value === 'string');
  return object;
}
