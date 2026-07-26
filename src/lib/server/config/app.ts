import { z } from 'zod';
import ipaddr from 'ipaddr.js';
import { getDatabase } from '$lib/server/db/driver';
import { privateConfig } from './private';

const SETTINGS_KEY = 'app_configuration';

export const appConfigSchema = z
  .object({
    version: z.literal(1),
    origin: z
      .string()
      .url()
      .refine(
        (value) => {
          const url = new URL(value);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            url.pathname === '/' &&
            !url.search &&
            !url.hash
          );
        },
        { message: 'Public address must contain only a scheme, host, and optional port' }
      ),
    authMode: z.enum(['none', 'password', 'proxy']),
    passwordHash: z.string(),
    proxyHeader: z.string().regex(/^[A-Za-z0-9-]+$/),
    proxyTrustedCidrs: z
      .array(
        z.string().refine(
          (value) => {
            try {
              ipaddr.parseCIDR(value);
              return true;
            } catch {
              return false;
            }
          },
          { message: 'Enter valid CIDR networks, such as 172.18.0.0/16' }
        )
      )
      .max(50)
  })
  .superRefine((value, context) => {
    if (value.authMode === 'password' && !value.passwordHash.startsWith('$argon2id$')) {
      context.addIssue({
        code: 'custom',
        path: ['passwordHash'],
        message: 'A valid password is required'
      });
    }
    if (value.authMode === 'proxy' && value.proxyTrustedCidrs.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['proxyTrustedCidrs'],
        message: 'At least one trusted proxy network is required'
      });
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;

function normalizeOrigin(origin: string): string {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Public address must use HTTP or HTTPS');
  return url.origin;
}

export function suggestedAppConfig(requestOrigin: string): AppConfig {
  return {
    version: 1,
    origin: normalizeOrigin(privateConfig.configuredOrigin ?? requestOrigin),
    authMode: privateConfig.authMode,
    passwordHash: privateConfig.authPasswordHash,
    proxyHeader: privateConfig.authProxyHeader,
    proxyTrustedCidrs: privateConfig.authProxyTrustedCidrs
  };
}

function readStoredConfig(): AppConfig | null {
  const row = getDatabase()
    .prepare('SELECT value_json FROM settings WHERE key = ?')
    .get(SETTINGS_KEY) as { value_json: string } | undefined;
  if (!row) return null;
  const parsed = appConfigSchema.safeParse(JSON.parse(row.value_json));
  if (!parsed.success) {
    throw new Error(`Stored application configuration is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function getAppConfig(): AppConfig | null {
  const stored = readStoredConfig();
  if (stored) return stored;

  // v1.0 deployments were configured entirely through environment variables.
  // Import that configuration once so upgrades do not unexpectedly enter setup.
  if (process.env.ORIGIN || process.env.AUTH_MODE) {
    const legacy = suggestedAppConfig(privateConfig.origin);
    saveAppConfig(legacy);
    return legacy;
  }
  return null;
}

export function saveAppConfig(config: AppConfig): AppConfig {
  const normalized = appConfigSchema.parse({
    ...config,
    origin: normalizeOrigin(config.origin),
    proxyHeader: config.proxyHeader.toLowerCase()
  });
  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json,
         updated_at = excluded.updated_at`
    )
    .run(SETTINGS_KEY, JSON.stringify(normalized), now);
  return normalized;
}

export function completeSetup(config: AppConfig): AppConfig {
  const normalized = appConfigSchema.parse({
    ...config,
    origin: normalizeOrigin(config.origin),
    proxyHeader: config.proxyHeader.toLowerCase()
  });
  try {
    getDatabase()
      .prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)')
      .run(SETTINGS_KEY, JSON.stringify(normalized), new Date().toISOString());
  } catch {
    throw new Error('MapMe setup was already completed in another request');
  }
  return normalized;
}

export function parseTrustedCidrs(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host');
  if (!host) return new URL(request.url).origin;
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol =
    forwardedProtocol === 'http' || forwardedProtocol === 'https' ? forwardedProtocol : 'http';
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return new URL(request.url).origin;
  }
}
