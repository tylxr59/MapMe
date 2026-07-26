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

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export const dateSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use YYYY-MM-DD')
  .refine((value) => value === '' || isCalendarDate(value), 'Invalid date')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export function formDataObject(form: FormData): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    object[key] = typeof value === 'string' ? value : value.name;
  }
  return object;
}
