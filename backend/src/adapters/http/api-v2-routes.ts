import fp from 'fastify-plugin';
import { z } from 'zod';

import type { ApiTokenService } from '../../application/api-token-service.js';
import type { AuthService } from '../../application/auth-service.js';
import type { WorkspaceService } from '../../application/workspace-service.js';
import { errors } from '../../domain/errors.js';
import type { User } from '../../domain/identity.js';

const CreateToken = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).optional(),
});

export const apiV2Routes = fp<{
  auth: AuthService;
  workspaces: WorkspaceService;
  tokens: ApiTokenService;
  publicUrl: string;
}>(
  async (app, opts) => {
    const requireUser = async (request: {
      authSession: Parameters<AuthService['requireUser']>[0];
      headers: { authorization?: string | undefined };
    }): Promise<User> => {
      const header = request.headers.authorization;
      if (typeof header === 'string' && header.startsWith('Bearer mosaic_pat_')) {
        const token = await opts.tokens.authenticate(header.slice(7));
        if (!token) {
          throw errors.authenticationRequired();
        }
        const user = await opts.auth.getUserById(token.userId);
        if (!user) {
          throw errors.authenticationRequired();
        }
        return user;
      }
      return opts.auth.requireUser(request.authSession);
    };

    app.get('/api/v2/openapi.json', async () => ({
      openapi: '3.1.0',
      info: {
        title: 'Mosaic API v2',
        version: '0.2.0',
        description:
          'Slice of the public REST API. GraphQL remains the primary client contract.',
      },
      servers: [{ url: opts.publicUrl }],
      paths: {
        '/api/v2/workspaces': {
          get: {
            summary: 'List workspaces for the current principal',
            security: [{ bearerAuth: [] }],
          },
        },
        '/api/v2/tokens': {
          get: { summary: 'List personal API tokens' },
          post: { summary: 'Create a personal API token' },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    }));

    app.get('/api/v2/tokens', async request => {
      const user = await requireUser(request);
      const tokens = await opts.tokens.list(user);
      return {
        items: tokens.map(token => ({
          id: token.id,
          name: token.name,
          fingerprint: token.fingerprint,
          scopes: token.scopes,
          createdAt: token.createdAt,
          lastUsedAt: token.lastUsedAt,
          revokedAt: token.revokedAt,
        })),
      };
    });

    app.post('/api/v2/tokens', async request => {
      const user = await requireUser(request);
      const body = CreateToken.parse(request.body ?? {});
      const created = await opts.tokens.create(user, {
        name: body.name,
        ...(body.scopes ? { scopes: body.scopes } : {}),
      });
      return {
        id: created.token.id,
        name: created.token.name,
        fingerprint: created.token.fingerprint,
        scopes: created.token.scopes,
        token: created.secret,
      };
    });

    app.delete('/api/v2/tokens/:id', async request => {
      const user = await requireUser(request);
      const { id } = request.params as { id: string };
      return { ok: await opts.tokens.revoke(user, id) };
    });

    app.get('/api/v2/workspaces', async request => {
      const user = await requireUser(request);
      const list = await opts.workspaces.list(user);
      return {
        items: list.map(workspace => ({
          id: workspace.id,
          name: workspace.name,
          createdAt: workspace.createdAt,
        })),
      };
    });
  }
);
