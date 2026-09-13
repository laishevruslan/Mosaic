import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';

import type { ScimService } from '../../application/scim-service.js';
import { AppError } from '../../domain/errors.js';

function bearer(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)/i.exec(header);
  return match?.[1];
}

function scimQuery(query: Record<string, unknown>) {
  return {
    startIndex: Number(query.startIndex ?? 1),
    count: Number(query.count ?? 100),
    ...(typeof query.filter === 'string' ? { filter: query.filter } : {}),
  };
}

export const scimRoutes = fp<{ scim: ScimService }>(
  async (app, opts) => {
    app.addContentTypeParser(
      'application/scim+json',
      { parseAs: 'string' },
      (_request, body, done) => {
        try {
          const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
          done(null, text ? JSON.parse(text) : {});
        } catch (error) {
          done(error as Error);
        }
      }
    );
    app.addHook('preHandler', async (request, reply) => {
      if (!request.url.startsWith('/scim/v2')) {
        return;
      }
      try {
        const org = await opts.scim.authenticate(
          bearer(request.headers.authorization)
        );
        (request as FastifyRequest & { scimOrg?: unknown }).scimOrg = org;
      } catch (error) {
        if (error instanceof AppError) {
          return reply.code(error.status).send({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: String(error.status),
            detail: error.message,
          });
        }
        throw error;
      }
    });

    const orgOf = (request: FastifyRequest) =>
      (request as FastifyRequest & { scimOrg?: unknown })
        .scimOrg as Awaited<ReturnType<ScimService['authenticate']>>;

    app.get('/scim/v2/ServiceProviderConfig', async () =>
      opts.scim.serviceProviderConfig()
    );
    app.get('/scim/v2/ResourceTypes', async () => opts.scim.resourceTypes());
    app.get('/scim/v2/Schemas', async () => ({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 0,
      Resources: [],
    }));

    app.get('/scim/v2/Users', async request =>
      opts.scim.listUsers(orgOf(request), scimQuery(request.query as Record<string, unknown>))
    );
    app.get('/scim/v2/Users/:id', async request => {
      const { id } = request.params as { id: string };
      return opts.scim.getUser(orgOf(request), id);
    });
    app.post('/scim/v2/Users', async (request, reply) => {
      const created = await opts.scim.createUser(
        orgOf(request),
        (request.body ?? {}) as never
      );
      return reply.code(201).send(created);
    });
    app.put('/scim/v2/Users/:id', async request => {
      const { id } = request.params as { id: string };
      return opts.scim.replaceUser(
        orgOf(request),
        id,
        (request.body ?? {}) as never
      );
    });
    app.patch('/scim/v2/Users/:id', async request => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { Operations?: unknown[] };
      return opts.scim.patchUser(
        orgOf(request),
        id,
        (body.Operations ?? []) as never
      );
    });
    app.delete('/scim/v2/Users/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      await opts.scim.deleteUser(orgOf(request), id);
      return reply.code(204).send();
    });

    app.get('/scim/v2/Groups', async request =>
      opts.scim.listGroups(orgOf(request), scimQuery(request.query as Record<string, unknown>))
    );
    app.get('/scim/v2/Groups/:id', async request => {
      const { id } = request.params as { id: string };
      return opts.scim.getGroup(orgOf(request), id);
    });
    app.post('/scim/v2/Groups', async (request, reply) => {
      const created = await opts.scim.createGroup(
        orgOf(request),
        (request.body ?? {}) as never
      );
      return reply.code(201).send(created);
    });
    app.put('/scim/v2/Groups/:id', async request => {
      const { id } = request.params as { id: string };
      return opts.scim.replaceGroup(
        orgOf(request),
        id,
        (request.body ?? {}) as never
      );
    });
    app.patch('/scim/v2/Groups/:id', async request => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { Operations?: unknown[] };
      return opts.scim.patchGroup(
        orgOf(request),
        id,
        (body.Operations ?? []) as never
      );
    });
    app.delete('/scim/v2/Groups/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      await opts.scim.deleteGroup(orgOf(request), id);
      return reply.code(204).send();
    });
  },
  { name: 'mosaic-scim-routes' }
);
