export function safeLocalRedirect(requested: string | null, origin: string): string {
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return '/';
  if (
    requested.includes('\\') ||
    [...requested].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    return '/';
  }

  try {
    const base = new URL(origin);
    const target = new URL(requested, base);
    if (target.origin !== base.origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}
