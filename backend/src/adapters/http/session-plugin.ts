import fp from 'fastify-plugin';

import type { AuthService } from '../../application/auth-service.js';
import type { SecurityPolicyService } from '../../application/security-policy-service.js';
import { normalizeClientIp } from '../../application/cidr.js';
import { COOKIE_SESSION } from './cookies.js';
import './fastify-types.js';

function bearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)/i.exec(header);
  return match?.[1];
}

export const sessionPlugin = fp<{
  auth: AuthService;
  policy?: SecurityPolicyService;
}>(
  async (app, opts) => {
    app.decorateRequest('authSession', null);
    app.addHook('onRequest', async request => {
      const token = bearerToken(request.headers.authorization);
      if (token) {
        request.authSession = await opts.auth.authenticateBearer(token);
      } else {
        request.authSession = await opts.auth.authenticateCookie(
          request.cookies[COOKIE_SESSION]
        );
      }
      if (request.authSession && opts.policy) {
        const url = request.url.split('?')[0] ?? '';
        if (!url.startsWith('/health') && !url.startsWith('/scim/')) {
          const forwarded = request.headers['x-forwarded-for'];
          const ip = normalizeClientIp(
            typeof forwarded === 'string'
              ? forwarded
              : request.ip
          );
          await opts.policy.assertClientIp(ip || '127.0.0.1');
        }
      }
    });
  },
  { name: 'mosaic-session', dependencies: ['@fastify/cookie'] }
);
