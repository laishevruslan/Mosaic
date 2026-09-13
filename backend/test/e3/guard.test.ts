import { describe, expect, it } from 'vitest';

import { S3BlobObjects } from '../../src/adapters/blobs/s3-objects.js';
import { DlpService } from '../../src/application/dlp-service.js';
import { errors } from '../../src/domain/errors.js';
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

describe('E3 — Guard + GDPR + DLP + KMS', () => {
  it('blocks public links on Confidential docs and honors legal hold', async () => {
    const built = await startTestApp();
    const owner = await signIn(built.app, 'guard@example.com');
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;

    const config = await gql(
      built.app,
      `query { serverConfig { kmsConfigured } }`
    );
    expect(
      (config.json() as { data: { serverConfig: { kmsConfigured: boolean } } })
        .data.serverConfig.kmsConfigured
    ).toBe(false);

    await gql(
      built.app,
      `mutation ($workspaceId: String!, $docId: String!) {
        setDocSensitivity(workspaceId: $workspaceId, docId: $docId, label: Confidential) {
          label
        }
      }`,
      {
        cookies: owner.cookies,
        variables: { workspaceId, docId: 'board-secret' },
      }
    );

    const blocked = await gql(
      built.app,
      `mutation ($workspaceId: String!) {
        publishDoc(workspaceId: $workspaceId, docId: "board-secret", mode: Page) {
          id
        }
      }`,
      { cookies: owner.cookies, variables: { workspaceId } }
    );
    expect(blocked.json()).toMatchObject({
      errors: [{ message: expect.stringMatching(/Confidential/i) }],
    });

    await gql(
      built.app,
      `mutation ($workspaceId: String!) {
        setDocSensitivity(workspaceId: $workspaceId, docId: "open-doc", label: Internal) {
          label
        }
      }`,
      { cookies: owner.cookies, variables: { workspaceId } }
    );
    const published = await gql(
      built.app,
      `mutation ($workspaceId: String!) {
        publishDoc(workspaceId: $workspaceId, docId: "open-doc", mode: Page) { id public }
      }`,
      { cookies: owner.cookies, variables: { workspaceId } }
    );
    expect(
      (published.json() as { data: { publishDoc: { public: boolean } } }).data
        .publishDoc.public
    ).toBe(true);

    await gql(
      built.app,
      `mutation ($workspaceId: String!) {
        setDocSensitivity(workspaceId: $workspaceId, docId: "open-doc", label: Confidential) {
          label
        }
      }`,
      { cookies: owner.cookies, variables: { workspaceId } }
    );
    const listed = await gql(
      built.app,
      `query ($id: String!) { workspace(id: $id) { publicDocs { id } } }`,
      { cookies: owner.cookies, variables: { id: workspaceId } }
    );
    expect(
      (
        listed.json() as {
          data: { workspace: { publicDocs: Array<{ id: string }> } };
        }
      ).data.workspace.publicDocs
    ).toEqual([]);

    await gql(
      built.app,
      `mutation ($input: SetWorkspaceRetentionInput!) {
        setWorkspaceRetention(input: $input) { legalHold retentionDays }
      }`,
      {
        cookies: owner.cookies,
        variables: {
          input: { workspaceId, legalHold: true, retentionDays: 90 },
        },
      }
    );

    const deleted = await gql(
      built.app,
      `mutation ($id: String!) { deleteWorkspace(id: $id) }`,
      { cookies: owner.cookies, variables: { id: workspaceId } }
    );
    expect(deleted.json()).toMatchObject({
      errors: [{ message: expect.stringMatching(/Legal hold/i) }],
    });

    await uploadBlob(built.app, owner.cookies, workspaceId, 'held.png');
    await gql(
      built.app,
      `mutation ($workspaceId: String!, $key: String!) {
        deleteBlob(workspaceId: $workspaceId, key: $key, permanently: false)
      }`,
      { cookies: owner.cookies, variables: { workspaceId, key: 'held.png' } }
    );
    expect(await built.blobs.gcAll()).toBe(0);

    const permanent = await gql(
      built.app,
      `mutation ($workspaceId: String!, $key: String!) {
        deleteBlob(workspaceId: $workspaceId, key: $key, permanently: true)
      }`,
      { cookies: owner.cookies, variables: { workspaceId, key: 'held.png' } }
    );
    expect(permanent.json()).toMatchObject({
      errors: [{ message: expect.stringMatching(/Legal hold/i) }],
    });
  });

  it('keeps recently deleted blobs until retentionDays elapses', async () => {
    const built = await startTestApp();
    const owner = await signIn(built.app, 'retain@example.com');
    const user = await built.store.findUserById(owner.body.id);
    expect(user).toBeTruthy();
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;

    await built.guard.setRetention(user!, workspaceId, {
      retentionDays: 30,
      legalHold: false,
    });
    await uploadBlob(built.app, owner.cookies, workspaceId, 'keep.png');
    const deleted = await gql(
      built.app,
      `mutation ($workspaceId: String!, $key: String!) {
        deleteBlob(workspaceId: $workspaceId, key: $key, permanently: false)
      }`,
      { cookies: owner.cookies, variables: { workspaceId, key: 'keep.png' } }
    );
    expect(deleted.json()).toMatchObject({ data: { deleteBlob: true } });
    expect(await built.blobs.gcAll()).toBe(0);

    await built.guard.setRetention(user!, workspaceId, {
      retentionDays: null,
      legalHold: false,
    });
    expect(await built.blobs.gcAll()).toBe(1);
  });

  it('exports and deletes an account, redacts AI, and signs S3 SSE-KMS headers', async () => {
    const prompts: string[] = [];
    const fetch: HttpFetcher = async (url, init) => {
      if (String(url).includes('/chat/completions')) {
        prompts.push(String(init?.body ?? ''));
        return jsonResponse({
          choices: [{ message: { content: 'ok' } }],
        });
      }
      return jsonResponse({}, 404);
    };
    const built = await startTestApp(
      {
        MOSAIC_AI_API_KEY: 'sk-test',
        MOSAIC_DLP_MODE: 'redact',
      },
      { fetch }
    );
    const owner = await signIn(built.app, 'gdpr@example.com');
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;

    await gql(
      built.app,
      `mutation ($id: ID!) {
        updateWorkspace(input: { id: $id, enableAi: true }) { id enableAi }
      }`,
      { cookies: owner.cookies, variables: { id: workspaceId } }
    );

    const session = await gql(
      built.app,
      `mutation ($options: CreateChatSessionInput!) {
        createCopilotSession(options: $options)
      }`,
      {
        cookies: owner.cookies,
        variables: {
          options: { workspaceId, promptName: 'chat', reuseLatestChat: false },
        },
      }
    );
    const sessionId = (
      session.json() as { data: { createCopilotSession: string } }
    ).data.createCopilotSession;
    await gql(
      built.app,
      `mutation ($options: CreateChatMessageInput!) {
        createCopilotMessage(options: $options)
      }`,
      {
        cookies: owner.cookies,
        variables: {
          options: {
            sessionId,
            content: 'mail me at alice@example.com please',
          },
        },
      }
    );
    expect(prompts.some(text => text.includes('[redacted-email]'))).toBe(true);
    expect(prompts.some(text => text.includes('alice@example.com'))).toBe(false);

    const exported = await gql(built.app, `mutation { exportMyData }`, {
      cookies: owner.cookies,
    });
    const raw = (exported.json() as { data: { exportMyData: unknown } }).data
      .exportMyData;
    const payload = (
      typeof raw === 'string' ? JSON.parse(raw) : raw
    ) as { user: { email: string } };
    expect(payload.user.email).toBe('gdpr@example.com');

    const erased = await gql(
      built.app,
      `mutation { deleteAccount { success } }`,
      { cookies: owner.cookies }
    );
    expect(
      (erased.json() as { data: { deleteAccount: { success: boolean } } }).data
        .deleteAccount.success
    ).toBe(true);

    const headers: string[] = [];
    const s3 = new S3BlobObjects({
      bucket: 'mosaic',
      region: 'eu-west-1',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
      sse: 'aws:kms',
      kmsKeyId: 'arn:aws:kms:eu-west-1:1:key/abc',
      fetch: async (_url, init) => {
        const h = init?.headers as Record<string, string>;
        headers.push(h['x-amz-server-side-encryption'] ?? '');
        headers.push(h['x-amz-server-side-encryption-aws-kms-key-id'] ?? '');
        return new Response(null, { status: 200 });
      },
    });
    await s3.put('blobs/ws/key', new Uint8Array([1, 2, 3]));
    expect(headers).toEqual(['aws:kms', 'arn:aws:kms:eu-west-1:1:key/abc']);
  });

  it('blocks Copilot prompts that match DLP findings', () => {
    const dlp = new DlpService('block');
    expect(() => dlp.applyText('mail me at alice@example.com')).toThrow(
      errors.dlpBlocked().message
    );
    expect(new DlpService('off').applyText('alice@example.com')).toBe(
      'alice@example.com'
    );
  });
});
