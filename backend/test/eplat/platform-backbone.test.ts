import { describe, expect, it } from 'vitest';

import { GcsBlobObjects } from '../../src/adapters/blobs/gcs-objects.js';
import { S3BlobObjects } from '../../src/adapters/blobs/s3-objects.js';
import { MemoryMailer } from '../../src/adapters/mail/memory.js';
import { cookieHeader } from '../helpers/cookies.js';
import { startTestApp } from '../helpers/app.js';

const SIGN_UP = {
  method: 'POST' as const,
  url: '/api/auth/sign-in',
};

async function signIn(
  app: Awaited<ReturnType<typeof startTestApp>>['app'],
  email: string,
  password = 'password12'
) {
  const res = await app.inject({
    ...SIGN_UP,
    headers: { 'content-type': 'application/json' },
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  return cookieHeader(res);
}

describe('E-Plat — production backbone', () => {
  it('GET /health/ready still skips redis when REDIS_URL is unset', async () => {
    const { app } = await startTestApp();
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json().checks.redis).toBe('skipped');
  });

  it('GET /health/ready is 503 when Redis is required but down', async () => {
    const { app } = await startTestApp({ REDIS_URL: 'redis://127.0.0.1:1' });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json().checks.redis).toBe('down');
  });

  it('sets security headers on API responses', async () => {
    const { app } = await startTestApp();
    const res = await app.inject({ method: 'GET', url: '/info' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['permissions-policy']).toMatch(/camera=\(\)/);
  });

  it('returns a non-stub appConfig for the instance admin', async () => {
    const { app } = await startTestApp({ MOSAIC_ALLOW_SIGNUP: true });
    const cookies = await signIn(app, 'admin@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: cookies, 'content-type': 'application/json' },
      payload: { query: 'query { appConfig }' },
    });
    const body = res.json() as {
      data?: { appConfig: { server?: { name?: string }; auth?: { allowSignup?: boolean } } };
      errors?: unknown;
    };
    expect(body.errors).toBeUndefined();
    expect(body.data?.appConfig.server?.name).toBe('Mosaic');
    expect(body.data?.appConfig.auth?.allowSignup).toBe(true);
  });

  it('persists an invitation notification and sends invite mail', async () => {
    const mailer = new MemoryMailer();
    const { app } = await startTestApp(undefined, { mailer });
    const ownerCookies = await signIn(app, 'owner@example.com');
    await signIn(app, 'member@example.com');
    const ws = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: ownerCookies, 'content-type': 'application/json' },
      payload: { query: 'mutation { createWorkspace { id } }' },
    });
    const workspaceId = (
      ws.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;
    const invite = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: ownerCookies, 'content-type': 'application/json' },
      payload: {
        query: `mutation {
          inviteMembers(workspaceId: "${workspaceId}", emails: ["member@example.com"]) {
            email inviteId error
          }
        }`,
      },
    });
    const inviteBody = invite.json() as {
      data: { inviteMembers: Array<{ inviteId: string | null; error: unknown }> };
    };
    expect(inviteBody.data.inviteMembers[0]?.inviteId).toBeTruthy();
    expect(inviteBody.data.inviteMembers[0]?.error).toBeNull();
    expect(mailer.sent.some(item => item.to === 'member@example.com')).toBe(
      true
    );

    const memberCookies = await signIn(app, 'member@example.com');
    const listed = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: memberCookies, 'content-type': 'application/json' },
      payload: {
        query: `query {
          currentUser {
            notifications(pagination: { first: 10 }) {
              totalCount
              edges { node { type read body } }
            }
          }
        }`,
      },
    });
    const page = (
      listed.json() as {
        data: {
          currentUser: {
            notifications: {
              totalCount: number;
              edges: Array<{ node: { type: string; body: { inviteId?: string } } }>;
            };
          };
        };
      }
    ).data.currentUser.notifications;
    expect(page.totalCount).toBeGreaterThan(0);
    expect(page.edges[0]?.node.type).toBe('Invitation');
  });

  it('mentionUser creates a Mention notification', async () => {
    const { app } = await startTestApp();
    const ownerCookies = await signIn(app, 'host@example.com');
    await signIn(app, 'guest@example.com');
    const created = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: ownerCookies, 'content-type': 'application/json' },
      payload: { query: 'mutation { createWorkspace { id } }' },
    });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;
    await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: ownerCookies, 'content-type': 'application/json' },
      payload: {
        query: `mutation {
          inviteMembers(workspaceId: "${workspaceId}", emails: ["guest@example.com"]) { inviteId }
        }`,
      },
    });
    const guestCookies = await signIn(app, 'guest@example.com');
    const invites = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: guestCookies, 'content-type': 'application/json' },
      payload: {
        query: `query {
          currentUser {
            notifications(pagination: { first: 5 }) {
              edges { node { body } }
            }
          }
        }`,
      },
    });
    const inviteId = (
      invites.json() as {
        data: {
          currentUser: {
            notifications: {
              edges: Array<{ node: { body: { inviteId?: string } } }>;
            };
          };
        };
      }
    ).data.currentUser.notifications.edges[0]?.node.body.inviteId;
    expect(inviteId).toBeTruthy();
    await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: guestCookies, 'content-type': 'application/json' },
      payload: {
        query: `mutation { acceptInviteById(inviteId: "${inviteId}") }`,
      },
    });
    const guest = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: guestCookies, 'content-type': 'application/json' },
      payload: { query: 'query { currentUser { id } }' },
    });
    const guestId = (guest.json() as { data: { currentUser: { id: string } } })
      .data.currentUser.id;
    const mention = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: ownerCookies, 'content-type': 'application/json' },
      payload: {
        query: `mutation {
          mentionUser(input: {
            userId: "${guestId}"
            workspaceId: "${workspaceId}"
            doc: { id: "doc-1", title: "Board", mode: edgeless }
          })
        }`,
      },
    });
    expect(
      (mention.json() as { data?: { mentionUser: string } }).data?.mentionUser
    ).toBeTruthy();
    const listed = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { cookie: guestCookies, 'content-type': 'application/json' },
      payload: {
        query: `query {
          currentUser {
            notifications(pagination: { first: 10 }) {
              edges { node { type } }
            }
          }
        }`,
      },
    });
    const types = (
      listed.json() as {
        data: {
          currentUser: {
            notifications: { edges: Array<{ node: { type: string } }> };
          };
        };
      }
    ).data.currentUser.notifications.edges.map(edge => edge.node.type);
    expect(types).toContain('Mention');
  });

  it('S3 blob adapter signs PutObject and GCS remains a stub', async () => {
    const calls: string[] = [];
    const s3 = new S3BlobObjects({
      bucket: 'mosaic',
      region: 'us-east-1',
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'secret',
      endpoint: 'http://127.0.0.1:9000',
      forcePathStyle: true,
      fetch: async (url, init) => {
        calls.push(`${init?.method} ${url}`);
        return new Response('', { status: 200 });
      },
    });
    await s3.put('blobs/ws/key', new Uint8Array([1, 2, 3]));
    expect(calls[0]).toMatch(/^PUT http:\/\/127\.0\.0\.1:9000\/mosaic\/blobs\/ws\/key/);
    const gcs = new GcsBlobObjects('bucket');
    await expect(gcs.put()).rejects.toMatchObject({ name: 'ACTION_FORBIDDEN' });
  });
});
