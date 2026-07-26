import { error } from '@sveltejs/kit';
import { getAppConfig } from '$lib/server/config/app';

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const expected = getAppConfig()?.origin ?? new URL(request.url).origin;
  if (!origin || origin !== expected) {
    throw error(403, 'Cross-origin mutation is not allowed');
  }
}
