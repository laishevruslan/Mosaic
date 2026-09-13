import { io, type Socket } from 'socket.io-client';
import { describe, expect, it } from 'vitest';
import { Doc as YDoc, encodeStateAsUpdate } from 'yjs';

import { generateTotp } from '../../src/application/totp.js';
import type { DnsResolver } from '../../src/domain/ports.js';
import { listenTestApp, startTestApp } from '../helpers/app.js';
import { cookieHeader } from '../helpers/cookies.js';

const PASSWORD = 'correcthorse';

function dnsStub(): DnsResolver & { set(domain: string, txt: string): void } {
  const records = new Map<string, string[][]>();
  return {
    resolveTxt: async domain => records.get(domain) ?? [],
    set(domain, txt) {
      records.set(domain, [[txt]]);
    },
  };
}

async function gql(
  app: Awaited<ReturnType<typeof startTestApp>>['app'],
  query: string,
  opts?: { cookies?: string; variables?: Record<string, unknown> }
) {
  return app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      'content-type': 'application/json',
      'x-operation-name': 'op',
      ...(opts?.cookies ? { cookie: opts.cookies } : {}),
    },
    payload: { query, variables: opts?.variables ?? {} },
  });
}

async function signIn(
  app: Awaited<ReturnType<typeof startTestApp>>['app'],
  email: string,
  password = PASSWORD
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    headers: { 'content-type': 'application/json' },
    payload: { email, password },
  });
  return res;
}

async function adminSession(
  app: Awaited<ReturnType<typeof startTestApp>>['app']
) {
  const res = await signIn(app, 'admin@corp.test');
  expect(res.statusCode).toBe(200);
  return cookieHeader(res);
}

describe('E0 — Identity & Admin', () => {
  it('verifies a domain via DNS TXT and then enforces SSO', async () => {
    const dns = dnsStub();
    const { app } = await startTestApp(undefined, { dns });
    const cookies = await adminSession(app);

    const added = await gql(
      app,
      `mutation { addOrganizationDomain(domain: "corp.test") { id domain token txtRecord } }`,
      { cookies }
    );
    const domain = (
      added.json() as {
        data: {
          addOrganizationDomain: { id: string; token: string; txtRecord: string };
        };
      }
    ).data.addOrganizationDomain;
    dns.set('corp.test', domain.txtRecord);

    const verified = await gql(
      app,
      `mutation Verify($id: String!) { verifyOrganizationDomain(id: $id) { verifiedAt } }`,
      { cookies, variables: { id: domain.id } }
    );
    expect(
      (verified.json() as { data: { verifyOrganizationDomain: { verifiedAt: string } } })
        .data.verifyOrganizationDomain.verifiedAt
    ).toBeTruthy();

    await gql(
      app,
      `mutation { updateInstanceSecurityPolicy(input: { requireSso: true, requireSsoDomains: ["corp.test"] }) { requireSso } }`,
      { cookies }
    );

    const blocked = await signIn(app, 'member@corp.test');
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { code: string }).code).toBe('ACTION_FORBIDDEN');
  });

  it('keeps password login until the claimed SSO domain is verified', async () => {
    const { app } = await startTestApp();
    const cookies = await adminSession(app);
    await gql(
      app,
      `mutation { updateInstanceSecurityPolicy(input: { requireSso: true, requireSsoDomains: ["corp.test"] }) { requireSso } }`,
      { cookies }
    );
    const allowed = await signIn(app, 'open@corp.test');
    expect(allowed.statusCode).toBe(200);
  });

  it('creates users through SCIM, lists groups, and disables with session revoke', async () => {
    const { app, sso } = await startTestApp();
    const cookies = await adminSession(app);
    const tokenRes = await gql(
      app,
      `mutation { createScimToken(name: "okta") { id token } }`,
      { cookies }
    );
    const token = (
      tokenRes.json() as { data: { createScimToken: { token: string } } }
    ).data.createScimToken.token as string;

    const created = await app.inject({
      method: 'POST',
      url: '/scim/v2/Users',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/scim+json',
      },
      payload: {
        userName: 'scim.user@corp.test',
        emails: [{ value: 'scim.user@corp.test', primary: true }],
        displayName: 'SCIM User',
        active: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const scimId = (created.json() as { id: string }).id;

    await gql(
      app,
      `mutation { updateOrganization(input: { jitEnabled: false }) { jitEnabled } }`,
      { cookies }
    );
    await expect(
      sso.completeProfile(
        {
          provider: 'OIDC',
          providerAccountId: 'no-jit',
          email: 'jit-off@corp.test',
          name: 'No JIT',
          groups: [],
        },
        'web'
      )
    ).rejects.toMatchObject({ code: 'SIGN_UP_FORBIDDEN' });

    await gql(
      app,
      `mutation { updateOrganization(input: { jitEnabled: true }) { jitEnabled } }`,
      { cookies }
    );
    const jit = await sso.completeProfile(
      {
        provider: 'OIDC',
        providerAccountId: 'jit-1',
        email: 'jit-on@corp.test',
        name: 'JIT User',
        groups: ['admins'],
      },
      'web'
    );
    expect(jit.user.email).toBe('jit-on@corp.test');

    const group = await app.inject({
      method: 'POST',
      url: '/scim/v2/Groups',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/scim+json',
      },
      payload: {
        displayName: 'Engineering',
        members: [{ value: scimId }],
      },
    });
    expect(group.statusCode).toBe(201);

    const listed = await app.inject({
      method: 'GET',
      url: '/scim/v2/Users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(
      (listed.json() as { totalResults: number }).totalResults
    ).toBeGreaterThan(0);

    await app.inject({
      method: 'PATCH',
      url: `/scim/v2/Users/${scimId}`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/scim+json',
      },
      payload: {
        Operations: [{ op: 'replace', path: 'active', value: false }],
      },
    });

    const logs = await gql(
      app,
      `query { auditLogs(action: "scim.user.disable", take: 10) { action targetId } }`,
      { cookies }
    );
    const events = (
      logs.json() as { data: { auditLogs: Array<{ action: string }> } }
    ).data.auditLogs;
    expect(events.some(item => item.action === 'scim.user.disable')).toBe(true);
  });

  it('enrolls TOTP and completes MFA login', async () => {
    const { app } = await startTestApp();
    const cookies = await adminSession(app);
    const begin = await app.inject({
      method: 'POST',
      url: '/api/auth/mfa/totp/begin',
      headers: { cookie: cookies },
    });
    const secret = (begin.json() as { secret: string }).secret;
    const confirm = await app.inject({
      method: 'POST',
      url: '/api/auth/mfa/totp/confirm',
      headers: { cookie: cookies, 'content-type': 'application/json' },
      payload: { code: generateTotp(secret) },
    });
    expect(confirm.statusCode).toBe(200);
    expect(
      (confirm.json() as { recoveryCodes: string[] }).recoveryCodes.length
    ).toBeGreaterThan(0);

    const challenge = await signIn(app, 'admin@corp.test');
    expect(challenge.statusCode).toBe(403);
    const body = challenge.json() as {
      code: string;
      data: { mfaToken: string };
    };
    expect(body.code).toBe('MFA_REQUIRED');
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/mfa/verify',
      headers: { 'content-type': 'application/json' },
      payload: { mfaToken: body.data.mfaToken, code: generateTotp(secret) },
    });
    expect(verified.statusCode).toBe(200);
  });

  it('blocks clients outside the IP allowlist and public edit links', async () => {
    const { app } = await startTestApp();
    const cookies = await adminSession(app);
    await gql(
      app,
      `mutation {
        updateInstanceSecurityPolicy(input: {
          ipAllowlist: ["10.0.0.0/8"]
          blockPublicEditLinks: true
        }) { ipAllowlist blockPublicEditLinks }
      }`,
      { cookies }
    );
    const denied = await gql(app, `query { currentUser { id } }`, { cookies });
    expect(denied.statusCode).toBe(403);

    const open = await startTestApp();
    const openCookies = await adminSession(open.app);
    const ws = await gql(open.app, `mutation { createWorkspace { id } }`, {
      cookies: openCookies,
    });
    const workspaceId = (
      ws.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;
    await gql(
      open.app,
      `mutation {
        updateInstanceSecurityPolicy(input: { blockPublicEditLinks: true }) {
          blockPublicEditLinks
        }
      }`,
      { cookies: openCookies }
    );
    const publish = await gql(
      open.app,
      `mutation Publish($workspaceId: String!, $docId: String!) {
        publishDoc(workspaceId: $workspaceId, docId: $docId, mode: Edgeless) { id }
      }`,
      { cookies: openCookies, variables: { workspaceId, docId: workspaceId } }
    );
    expect(
      (publish.json() as { errors?: Array<{ message: string }> }).errors?.[0]
        ?.message
    ).toMatch(/Public edit links/);
  });

  it('exposes admin users GraphQL, workspaces, and audit CSV', async () => {
    const { app } = await startTestApp();
    const cookies = await adminSession(app);
    const created = await gql(
      app,
      `mutation {
        createUser(input: { email: "import@corp.test", name: "Imported", password: "correcthorse" }) {
          id email disabled
        }
      }`,
      { cookies }
    );
    expect(
      (created.json() as { data: { createUser: { email: string } } }).data
        .createUser.email
    ).toBe('import@corp.test');

    const listed = await gql(
      app,
      `query {
        users(filter: { first: 20, skip: 0 }) { email disabled features }
        usersCount(filter: { first: 20, skip: 0 })
        adminWorkspaces(filter: { first: 20, skip: 0 }) { id name }
        adminServer: serverConfig { availableUserFeatures }
      }`,
      { cookies }
    );
    const body = listed.json() as {
      data: {
        users: Array<{ email: string }>;
        usersCount: number;
        adminWorkspaces: unknown[];
        adminServer: { availableUserFeatures: string[] };
      };
      errors?: unknown;
    };
    expect(body.errors).toBeUndefined();
    expect(body.data.usersCount).toBeGreaterThan(0);
    expect(body.data.adminServer.availableUserFeatures).toContain('Admin');

    const csv = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?format=csv',
      headers: { cookie: cookies },
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.body).toContain('createdAt,action');
  });

  it('revokes live sync push after SCIM disable', async () => {
    const { app, url } = await listenTestApp();
    const adminCookies = await adminSession(app);
    await gql(
      app,
      `mutation {
        createUser(input: { email: "pusher@corp.test", password: "correcthorse", name: "Pusher" }) { id }
      }`,
      { cookies: adminCookies }
    );
    const userRes = await signIn(app, 'pusher@corp.test');
    const userCookies = cookieHeader(userRes);
    const ws = await gql(app, `mutation { createWorkspace { id } }`, {
      cookies: userCookies,
    });
    const workspaceId = (
      ws.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;

    const token = (
      (
        await gql(
          app,
          `mutation { createScimToken(name: "deprov") { token } }`,
          { cookies: adminCookies }
        )
      ).json() as { data: { createScimToken: { token: string } } }
    ).data.createScimToken.token as string;
    const scimUser = await app.inject({
      method: 'POST',
      url: '/scim/v2/Users',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/scim+json',
      },
      payload: {
        userName: 'pusher@corp.test',
        emails: [{ value: 'pusher@corp.test', primary: true }],
        active: true,
      },
    });
    expect(scimUser.statusCode).toBe(201);
    const scimId = (scimUser.json() as { id: string }).id;

    const socket = await new Promise<Socket>((resolve, reject) => {
      const client = io(url, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        extraHeaders: { cookie: userCookies },
        reconnection: false,
        timeout: 5000,
        forceNew: true,
      });
      const timer = setTimeout(() => {
        client.disconnect();
        reject(new Error('socket connect timeout'));
      }, 8_000);
      client.once('connect', () => {
        clearTimeout(timer);
        resolve(client);
      });
      client.once('connect_error', error => {
        clearTimeout(timer);
        reject(error);
      });
    });
    await socket.timeout(8_000).emitWithAck('space:join-batch', {
      spaces: [{ spaceType: 'workspace', spaceId: workspaceId }],
      clientVersion: '0.27.5',
    });

    await app.inject({
      method: 'PATCH',
      url: `/scim/v2/Users/${scimId}`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/scim+json',
      },
      payload: {
        Operations: [{ op: 'replace', path: 'active', value: false }],
      },
    });

    const doc = new YDoc();
    doc.getMap('root').set('k', 'v');
    const pushed = (await socket.timeout(8_000).emitWithAck(
      'space:push-doc-update',
      {
        spaceType: 'workspace',
        spaceId: workspaceId,
        docId: workspaceId,
        update: Buffer.from(encodeStateAsUpdate(doc)).toString('base64'),
      }
    )) as { error?: { name?: string } };
    socket.disconnect();
    expect(pushed.error?.name ?? pushed.error).toBeTruthy();
  });
});
