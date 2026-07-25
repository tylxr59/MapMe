import { z } from 'zod';
import { building, dev } from '$app/environment';
import { resolve } from 'node:path';

const booleanEnv = (defaultValue: 'true' | 'false' = 'false') =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue)
    .transform((value) => value === 'true' || value === '1');

const environmentSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    ORIGIN: z.string().url().optional(),
    DATABASE_PATH: z
      .string()
      .min(1)
      .default(dev ? './data/database.sqlite' : '/data/database.sqlite'),
    UPLOAD_PATH: z
      .string()
      .min(1)
      .default(dev ? './data/uploads' : '/data/uploads'),
    BACKUP_PATH: z
      .string()
      .min(1)
      .default(dev ? './data/backups' : '/data/backups'),
    AUTH_MODE: z.enum(['none', 'password', 'proxy']).default('none'),
    AUTH_PASSWORD_HASH: z.string().default(''),
    AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    AUTH_PROXY_HEADER: z
      .string()
      .regex(/^[A-Za-z0-9-]+$/)
      .default('Remote-User'),
    AUTH_PROXY_TRUSTED_CIDRS: z.string().default(''),
    TILE_URL: z
      .string()
      .url()
      .refine((value) => ['{z}', '{x}', '{y}'].every((token) => value.includes(token)), {
        message: 'TILE_URL must contain {z}, {x}, and {y}'
      })
      .default('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    TILE_ATTRIBUTION: z.string().min(1).default('© OpenStreetMap contributors'),
    TILE_MAX_ZOOM: z.coerce.number().int().min(1).max(24).default(19),
    TILE_PROXY_ENABLED: booleanEnv('true'),
    TILE_CACHE_PATH: z
      .string()
      .min(1)
      .default(dev ? './data/tile-cache' : '/data/tile-cache'),
    TILE_CACHE_MAX_MB: z.coerce.number().int().min(64).max(16_384).default(512),
    GEOCODING_ENABLED: booleanEnv('true'),
    GEOCODING_PROVIDER: z.literal('nominatim').default('nominatim'),
    GEOCODING_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
    GEOCODING_API_KEY: z.string().default(''),
    GEOCODING_AUTOCOMPLETE: booleanEnv(),
    GEOCODING_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
    UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).max(100).default(15),
    UPLOAD_MAX_FILES_PER_PLACE: z.coerce.number().int().min(1).max(100).default(10),
    IMPORT_MAX_SIZE_MB: z.coerce.number().int().min(1).max(500).default(25),
    RESTORE_MAX_SIZE_MB: z.coerce.number().int().min(1).max(10_240).default(2048)
  })
  .superRefine((value, context) => {
    if (!dev && !building && !value.ORIGIN) {
      context.addIssue({
        code: 'custom',
        path: ['ORIGIN'],
        message: 'ORIGIN is required in production'
      });
    }
    if (value.AUTH_MODE === 'password' && !value.AUTH_PASSWORD_HASH.startsWith('$argon2id$')) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_PASSWORD_HASH'],
        message: 'AUTH_PASSWORD_HASH must be an Argon2id PHC hash in password mode'
      });
    }
    if (value.AUTH_MODE === 'proxy' && value.AUTH_PROXY_TRUSTED_CIDRS.trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_PROXY_TRUSTED_CIDRS'],
        message: 'At least one trusted CIDR is required in proxy mode'
      });
    }
  });

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid MapMe configuration: ${details}`);
}

const env = parsed.data;

export const privateConfig = Object.freeze({
  port: env.PORT,
  origin: env.ORIGIN ?? 'http://localhost:3000',
  databasePath: resolve(env.DATABASE_PATH),
  uploadPath: resolve(env.UPLOAD_PATH),
  backupPath: resolve(env.BACKUP_PATH),
  authMode: env.AUTH_MODE,
  authPasswordHash: env.AUTH_PASSWORD_HASH,
  authSessionTtlDays: env.AUTH_SESSION_TTL_DAYS,
  authProxyHeader: env.AUTH_PROXY_HEADER.toLowerCase(),
  authProxyTrustedCidrs: env.AUTH_PROXY_TRUSTED_CIDRS.split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  tileUrl: env.TILE_URL,
  tileAttribution: env.TILE_ATTRIBUTION,
  tileMaxZoom: env.TILE_MAX_ZOOM,
  tileProxyEnabled: env.TILE_PROXY_ENABLED,
  tileCachePath: resolve(env.TILE_CACHE_PATH),
  tileCacheMaxMb: env.TILE_CACHE_MAX_MB,
  geocodingEnabled: env.GEOCODING_ENABLED,
  geocodingProvider: env.GEOCODING_PROVIDER,
  geocodingUrl: env.GEOCODING_URL.replace(/\/+$/, ''),
  geocodingApiKey: env.GEOCODING_API_KEY,
  geocodingAutocomplete: env.GEOCODING_AUTOCOMPLETE,
  geocodingCacheTtlDays: env.GEOCODING_CACHE_TTL_DAYS,
  uploadMaxFileSizeMb: env.UPLOAD_MAX_FILE_SIZE_MB,
  uploadMaxFilesPerPlace: env.UPLOAD_MAX_FILES_PER_PLACE,
  importMaxSizeMb: env.IMPORT_MAX_SIZE_MB,
  restoreMaxSizeMb: env.RESTORE_MAX_SIZE_MB
});

export type PrivateConfig = typeof privateConfig;
