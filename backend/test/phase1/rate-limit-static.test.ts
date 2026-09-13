import { describe, expect, it } from 'vitest';

import { isRateLimitExempt } from '../../src/adapters/http/rate-limit-allowlist.js';
import { startTestApp } from '../helpers/app.js';

describe('rate-limit allowlist', () => {
  it('exempts health, metrics, and all GET/HEAD (fonts, SPA, assets)', () => {
    expect(isRateLimitExempt('GET', '/fonts/Inter-Regular.woff2')).toBe(true);
    expect(isRateLimitExempt('GET', '/assets/other-page.dark.119524bd.png')).toBe(
      true
    );
    expect(isRateLimitExempt('GET', '/js/index.js')).toBe(true);
    expect(isRateLimitExempt('HEAD', '/fonts/Poppins-Regular.woff2')).toBe(true);
    expect(isRateLimitExempt('GET', '/health/live')).toBe(true);
    expect(isRateLimitExempt('GET', '/metrics')).toBe(true);
    expect(isRateLimitExempt('GET', '/info')).toBe(true);
  });

  it('still limits GraphQL and API writes', () => {
    expect(isRateLimitExempt('POST', '/graphql')).toBe(false);
    expect(isRateLimitExempt('POST', '/api/auth/preflight')).toBe(false);
  });

  it('does not spend the GraphQL budget on font GET', async () => {
    const { app } = await startTestApp({ RATE_LIMIT_MAX: 1 });
    const fontA = await app.inject({
      method: 'GET',
      url: '/fonts/Inter-Regular.woff2',
    });
    const fontB = await app.inject({
      method: 'GET',
      url: '/fonts/Kalam-Bold.woff2',
    });
    expect(fontA.statusCode).not.toBe(429);
    expect(fontB.statusCode).not.toBe(429);

    const gql = {
      method: 'POST' as const,
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: { query: '{ __typename }' },
    };
    const first = await app.inject(gql);
    expect(first.statusCode).not.toBe(429);
    const second = await app.inject(gql);
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ name: 'TOO_MANY_REQUEST' });
  });
});
