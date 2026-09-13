import fp from 'fastify-plugin';
import { z } from 'zod';

import type { AuthService } from '../../application/auth-service.js';
import type { MfaService } from '../../application/mfa-service.js';
import { attachAuthCookies, type CookiePolicy } from './cookies.js';
import { publicUser } from '../../application/auth-service.js';

const TotpConfirm = z.object({
  code: z.string().min(6).max(8),
});

const PasskeyRegister = z.object({
  credentialId: z.string().min(1),
  publicKey: z.string().min(1),
  deviceName: z.string().optional(),
});

const LoginVerify = z.object({
  mfaToken: z.string().min(1),
  code: z.string().optional(),
  recoveryCode: z.string().optional(),
});

export const mfaRoutes = fp<{
  auth: AuthService;
  mfa: MfaService;
  cookies: CookiePolicy;
}>(
  async (app, opts) => {
    app.get('/api/auth/mfa/status', async request => {
      const user = await opts.auth.requireUser(request.authSession);
      return opts.mfa.status(user);
    });

    app.post('/api/auth/mfa/totp/begin', async request => {
      const user = await opts.auth.requireUser(request.authSession);
      return opts.mfa.beginTotp(user);
    });

    app.post('/api/auth/mfa/totp/confirm', async request => {
      const user = await opts.auth.requireUser(request.authSession);
      const body = TotpConfirm.parse(request.body);
      return opts.mfa.confirmTotp(user, body.code);
    });

    app.post('/api/auth/mfa/passkey/register', async request => {
      const user = await opts.auth.requireUser(request.authSession);
      const body = PasskeyRegister.parse(request.body);
      return opts.mfa.registerPasskey(user, {
        credentialId: body.credentialId,
        publicKey: body.publicKey,
        ...(body.deviceName ? { deviceName: body.deviceName } : {}),
      });
    });

    app.post('/api/auth/mfa/passkey/challenge', async request => {
      const user = await opts.auth.requireUser(request.authSession);
      return opts.mfa.passkeyChallenge(user);
    });

    app.post('/api/auth/mfa/verify', async (request, reply) => {
      const body = LoginVerify.parse(request.body);
      const result = await opts.mfa.completeLogin({
        mfaToken: body.mfaToken,
        ...(body.code ? { code: body.code } : {}),
        ...(body.recoveryCode ? { recoveryCode: body.recoveryCode } : {}),
        clientKind:
          request.headers['x-affine-client-kind'] === 'native'
            ? 'native'
            : 'web',
      });
      attachAuthCookies(reply, result.session, result.cookieToken, opts.cookies);
      return publicUser(result.user);
    });
  },
  { name: 'mosaic-mfa-routes' }
);
