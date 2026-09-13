/**
 * Paths that must not share the GraphQL/API request budget.
 * Fonts, JS, and images retry on 429 and will otherwise lock the SPA.
 */
export function isRateLimitExempt(method: string, url: string): boolean {
  const path = (url.split('?')[0] ?? '/').split('#')[0] || '/';
  const verb = method.toUpperCase();

  if (
    path === '/metrics' ||
    path === '/info' ||
    path.startsWith('/health') ||
    path.startsWith('/socket.io')
  ) {
    return true;
  }

  if (verb === 'GET' || verb === 'HEAD') {
    return true;
  }

  return false;
}
