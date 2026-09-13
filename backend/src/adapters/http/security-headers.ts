import fp from 'fastify-plugin';

export const securityHeadersPlugin = fp<{
  hsts: boolean;
}>(
  async (app, opts) => {
    app.addHook('onSend', async (_request, reply) => {
      void reply.header('x-content-type-options', 'nosniff');
      void reply.header('referrer-policy', 'no-referrer');
      void reply.header('x-frame-options', 'SAMEORIGIN');
      void reply.header(
        'permissions-policy',
        'camera=(), microphone=(), geolocation=(), payment=()'
      );
      void reply.header(
        'content-security-policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
      );
      if (opts.hsts) {
        void reply.header(
          'strict-transport-security',
          'max-age=31536000; includeSubDomains'
        );
      }
    });
  },
  { name: 'mosaic-security-headers' }
);
