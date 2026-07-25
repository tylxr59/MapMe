import { error } from '@sveltejs/kit';
import { privateConfig } from '$lib/server/config/private';

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(privateConfig.origin).origin) {
    throw error(403, 'Cross-origin mutation is not allowed');
  }
}
