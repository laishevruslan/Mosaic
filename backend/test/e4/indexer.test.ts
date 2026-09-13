import { describe, expect, it } from 'vitest';
import { Doc as YDoc, encodeStateAsUpdate } from 'yjs';

import { extractSearchDocuments, yjsHaystack } from '../../src/application/indexer-extract.js';
import type { HttpFetcher } from '../../src/domain/ports.js';
import { startTestApp } from '../helpers/app.js';
import { cookieHeader } from '../helpers/cookies.js';

const CREATE = `mutation createWorkspace { createWorkspace { id } }`;

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00,
  0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

async function uploadBlob(
  app: Awaited<ReturnType<typeof startTestApp>>['app'],
  cookies: string,
  workspaceId: string,
  key: string
) {
  const created = await gql(
    app,
    `mutation ($workspaceId: String!, $key: String!, $size: Int!, $mime: String!) {
      createBlobUpload(workspaceId: $workspaceId, key: $key, size: $size, mime: $mime) {
        uploadUrl
      }
    }`,
    {
      cookies,
      variables: {
        workspaceId,
        key,
        size: PNG.byteLength,
        mime: 'application/octet-stream',
      },
    }
  );
  const body = created.json() as {
    data?: { createBlobUpload: { uploadUrl: string } };
    errors?: unknown[];
  };
  expect(body.errors).toBeUndefined();
  const uploadUrl = body.data?.createBlobUpload.uploadUrl;
  expect(uploadUrl).toBeTruthy();
  const put = await app.inject({
    method: 'PUT',
    url: uploadUrl!,
    headers: { 'content-type': 'application/octet-stream' },
    payload: Buffer.from(PNG),
  });
  expect(put.statusCode).toBe(200);
  const done = await gql(
    app,
    `mutation ($workspaceId: String!, $key: String!) {
      completeBlobUpload(workspaceId: $workspaceId, key: $key)
    }`,
    { cookies, variables: { workspaceId, key } }
  );
  expect(done.json()).toMatchObject({ data: { completeBlobUpload: key } });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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
  password = 'correcthorse'
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    headers: { 'content-type': 'application/json' },
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  return { cookies: cookieHeader(res), body: res.json() as { id: string } };
}

describe('E4 — indexer, analytics, captcha', () => {
  it('extracts widget and kanban titles from Yjs JSON', () => {
    const doc = new YDoc();
    doc.getMap('blocks').set('root', {
      flavour: 'wb:board',
      id: 'board-block',
      props: { title: 'Sprint board' },
      children: [
        {
          flavour: 'affine:database',
          id: 'db-1',
          title: 'Kanban card alpha',
          cells: [{ title: 'Ship the indexer', flavour: 'affine:paragraph' }],
        },
        { flavour: 'wb:chart', id: 'chart-1', props: { title: 'Revenue chart' } },
      ],
    });
    const haystack = yjsHaystack(encodeStateAsUpdate(doc), []);
    const docs = extractSearchDocuments({
      workspaceId: 'ws',
      docId: 'doc-1',
      haystack,
      comments: [],
      updatedAt: new Date(),
    });
    const blob = docs.map(row => `${row.flavour}:${row.title}:${row.body}`).join('\n');
    expect(blob).toContain('Kanban card alpha');
    expect(blob).toContain('Revenue chart');
    expect(blob).toContain('Sprint board');
  });

  it('indexes Yjs widgets and comments, then searchDocs/aggregate find them', async () => {
    const built = await startTestApp();
    const owner = await signIn(built.app, 'indexer@example.com');
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;
    const user = await built.store.findUserById(owner.body.id);
    const doc = new YDoc();
    doc.getMap('blocks').set('root', {
      flavour: 'wb:board',
      id: 'board-block',
      props: { title: 'Delivery kanban' },
      children: [{ flavour: 'affine:paragraph', title: 'Kanban card alpha' }],
    });
    await built.docs.push(user!, {
      spaceType: 'workspace',
      spaceId: workspaceId,
      docId: 'board-e4',
      update: encodeStateAsUpdate(doc),
    });
    await gql(
      built.app,
      `mutation ($input: CommentCreateInput!) {
        createComment(input: $input) { id }
      }`,
      {
        cookies: owner.cookies,
        variables: {
          input: {
            workspaceId,
            docId: 'board-e4',
            content: { text: 'indexer comment needle' },
          },
        },
      }
    );
    const reindex = await built.app.inject({
      method: 'POST',
      url: `/api/admin/indexer/reindex?workspaceId=${workspaceId}`,
      headers: { cookie: owner.cookies },
    });
    expect(reindex.statusCode).toBe(200);
    expect(
      (reindex.json() as { indexed: number }).indexed
    ).toBeGreaterThan(0);

    const found = await gql(
      built.app,
      `query ($id: String!, $input: SearchDocsInput!) {
        workspace(id: $id) {
          searchDocs(input: $input) { docId title highlight }
        }
      }`,
      {
        cookies: owner.cookies,
        variables: { id: workspaceId, input: { keyword: 'Kanban card alpha' } },
      }
    );
    const hits = (
      found.json() as {
        data: { workspace: { searchDocs: Array<{ docId: string; highlight: string }> } };
      }
    ).data.workspace.searchDocs;
    expect(hits.some(hit => hit.docId === 'board-e4')).toBe(true);

    const commentHit = await gql(
      built.app,
      `query ($id: String!, $input: SearchDocsInput!) {
        workspace(id: $id) {
          searchDocs(input: $input) { docId highlight }
        }
      }`,
      {
        cookies: owner.cookies,
        variables: { id: workspaceId, input: { keyword: 'comment needle' } },
      }
    );
    expect(
      (
        commentHit.json() as {
          data: { workspace: { searchDocs: Array<{ docId: string }> } };
        }
      ).data.workspace.searchDocs.some(hit => hit.docId === 'board-e4')
    ).toBe(true);

    const aggregated = await gql(
      built.app,
      `query ($id: String!, $input: AggregateInput!) {
        workspace(id: $id) {
          aggregate(input: $input) {
            buckets { key count }
            pagination { count }
          }
        }
      }`,
      {
        cookies: owner.cookies,
        variables: {
          id: workspaceId,
          input: { field: 'flavour', table: 'block' },
        },
      }
    );
    const buckets = (
      aggregated.json() as {
        data: {
          workspace: {
            aggregate: { buckets: Array<{ key: string; count: number }> };
          };
        };
      }
    ).data.workspace.aggregate.buckets;
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.some(bucket => bucket.count > 0)).toBe(true);
  });

  it('fills adminDashboard storage, copilot, and shared-link views', async () => {
    const built = await startTestApp({ MOSAIC_AI_API_KEY: 'sk-test' });
    const owner = await signIn(built.app, 'dashboard@example.com');
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;

    await uploadBlob(built.app, owner.cookies, workspaceId, 'dash.png');

    const user = await built.store.findUserById(owner.body.id);
    const shared = new YDoc();
    shared.getText('content').insert(0, 'public board');
    await built.docs.push(user!, {
      spaceType: 'workspace',
      spaceId: workspaceId,
      docId: 'shared-e4',
      update: encodeStateAsUpdate(shared),
    });

    await gql(
      built.app,
      `mutation ($workspaceId: String!, $docId: String!) {
        publishDoc(workspaceId: $workspaceId, docId: $docId, mode: Page) { id public }
      }`,
      {
        cookies: owner.cookies,
        variables: { workspaceId, docId: 'shared-e4' },
      }
    );
    const pub = await built.app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/public-docs/shared-e4`,
    });
    expect(pub.statusCode).toBe(200);

    const session = await gql(
      built.app,
      `mutation ($options: CreateChatSessionInput!) {
        createCopilotSession(options: $options)
      }`,
      {
        cookies: owner.cookies,
        variables: {
          options: {
            workspaceId,
            promptName: 'chat',
            reuseLatestChat: false,
          },
        },
      }
    );
    expect(
      (session.json() as { data?: { createCopilotSession: string }; errors?: unknown })
        .data?.createCopilotSession
    ).toBeTruthy();

    const dash = await gql(
      built.app,
      `query {
        adminDashboard {
          blobStorageBytes
          workspaceStorageBytes
          copilotConversations
          topSharedLinks { docId views }
        }
      }`,
      { cookies: owner.cookies }
    );
    const body = dash.json() as {
      data?: {
        adminDashboard: {
          blobStorageBytes: number;
          workspaceStorageBytes: number;
          copilotConversations: number;
          topSharedLinks: Array<{ docId: string; views: number }>;
        };
      };
      errors?: unknown;
    };
    expect(body.errors).toBeUndefined();
    expect(body.data?.adminDashboard.blobStorageBytes).toBeGreaterThan(0);
    expect(body.data?.adminDashboard.workspaceStorageBytes).toBeGreaterThan(0);
    expect(body.data?.adminDashboard.copilotConversations).toBeGreaterThan(0);
    expect(
      body.data?.adminDashboard.topSharedLinks.some(
        item => item.docId === 'shared-e4' && item.views > 0
      )
    ).toBe(true);
  });

  it('keeps captcha off by default and issues HMAC tokens when enabled', async () => {
    const off = await startTestApp();
    const denied = await off.app.inject({ method: 'GET', url: '/api/auth/captcha' });
    expect(denied.statusCode).toBe(403);

    const on = await startTestApp({ MOSAIC_CAPTCHA_ENABLED: true });
    const issued = await on.app.inject({ method: 'GET', url: '/api/auth/captcha' });
    expect(issued.statusCode).toBe(200);
    const token = (issued.json() as { token: string }).token;
    expect(token).toContain('.');

    const missing = await on.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'captcha@example.com', password: 'correcthorse' },
    });
    expect(missing.statusCode).toBe(400);

    const ok = await on.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: { 'content-type': 'application/json' },
      payload: {
        email: 'captcha@example.com',
        password: 'correcthorse',
        captchaToken: token,
      },
    });
    expect(ok.statusCode).toBe(200);

    const features = await gql(on.app, `query { serverConfig { features } }`);
    expect(
      (features.json() as { data: { serverConfig: { features: string[] } } })
        .data.serverConfig.features
    ).toContain('Captcha');
  });

  it('optionally dual-writes to OpenSearch over HTTP without a live cluster', async () => {
    const calls: string[] = [];
    const fetchFn: HttpFetcher = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (String(url).includes('_search')) {
        return jsonResponse({
          hits: {
            hits: [
              {
                _source: {
                  workspaceId: 'ws',
                  docId: 'board-os',
                  blockId: '',
                  flavour: 'wb:board',
                  title: 'OpenSearch hit',
                  body: 'alpha',
                  updatedAt: new Date().toISOString(),
                },
              },
            ],
          },
        });
      }
      return jsonResponse({ result: 'created' });
    };
    const built = await startTestApp(
      {
        MOSAIC_INDEXER_DRIVER: 'opensearch',
        OPENSEARCH_URL: 'http://opensearch.test',
      },
      { fetch: fetchFn }
    );
    const owner = await signIn(built.app, 'opensearch@example.com');
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;
    const user = await built.store.findUserById(owner.body.id);
    const doc = new YDoc();
    doc.getText('content').insert(0, 'opensearch dual write');
    await built.docs.push(user!, {
      spaceType: 'workspace',
      spaceId: workspaceId,
      docId: 'board-os',
      update: encodeStateAsUpdate(doc),
    });
    const reindex = await built.app.inject({
      method: 'POST',
      url: `/api/admin/indexer/reindex?workspaceId=${workspaceId}`,
      headers: { cookie: owner.cookies },
    });
    expect(reindex.statusCode).toBe(200);
    expect(calls.some(call => call.includes('_doc'))).toBe(true);
  });
});
