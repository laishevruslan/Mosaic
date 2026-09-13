import { describe, expect, it } from 'vitest';
import { Doc as YDoc, encodeStateAsUpdate } from 'yjs';

import type { HttpFetcher } from '../../src/domain/ports.js';
import { startTestApp } from '../helpers/app.js';
import { cookieHeader } from '../helpers/cookies.js';

const CREATE = `mutation createWorkspace { createWorkspace { id } }`;

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

describe('E2 — AI Gateway, Copilot, MCP, embeddings, Calendar', () => {
  it('exposes calendar providers without advertising CopilotEmbedding until indexed', async () => {
    const { app } = await startTestApp();
    const res = await gql(
      app,
      `query {
        serverConfig {
          features
          calendarProviders
          calendarCalDAVProviders { id label }
        }
      }`
    );
    const body = res.json() as {
      data: {
        serverConfig: {
          features: string[];
          calendarProviders: string[];
          calendarCalDAVProviders: Array<{ id: string }>;
        };
      };
    };
    expect(body.data.serverConfig.calendarProviders).toEqual([
      'Google',
      'CalDAV',
    ]);
    expect(body.data.serverConfig.calendarCalDAVProviders.map(p => p.id)).toContain(
      'fastmail'
    );
    expect(body.data.serverConfig.features).not.toContain('CopilotEmbedding');
  });

  it('runs Copilot session/history/stream, MCP read tools, RAG embed, calendar events, BYOK and API tokens', async () => {
    const prompts: string[] = [];
    const fetch: HttpFetcher = async (url, init) => {
      if (String(url).includes('/chat/completions')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          messages?: Array<{ content?: string }>;
        };
        prompts.push(body.messages?.map(m => m.content).join('\n') ?? '');
        return jsonResponse({
          choices: [{ message: { content: 'board summary from rag' } }],
        });
      }
      return jsonResponse({}, 404);
    };
    const built = await startTestApp(
      { MOSAIC_AI_API_KEY: 'sk-test', MOSAIC_AI_BASE_URL: 'https://ai.example/v1' },
      { fetch }
    );
    const owner = await signIn(built.app, 'e2@example.com');
    const created = await gql(built.app, CREATE, { cookies: owner.cookies });
    const workspaceId = (
      created.json() as { data: { createWorkspace: { id: string } } }
    ).data.createWorkspace.id;

    await gql(
      built.app,
      `mutation ($id: ID!) {
        updateWorkspace(input: { id: $id, enableAi: true, enableDocEmbedding: true }) {
          id enableAi enableDocEmbedding
        }
      }`,
      { cookies: owner.cookies, variables: { id: workspaceId } }
    );

    const user = await built.store.findUserById(owner.body.id);
    const doc = new YDoc();
    doc.getText('content').insert(0, 'secret board alpha roadmap');
    await built.docs.push(user!, {
      spaceType: 'workspace',
      spaceId: workspaceId,
      docId: 'board-e2',
      update: encodeStateAsUpdate(doc),
    });
    const embed = await built.app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/ai/embed`,
      headers: {
        'content-type': 'application/json',
        cookie: owner.cookies,
      },
      payload: { docId: 'board-e2' },
    });
    expect(embed.statusCode).toBe(200);

    const features = await gql(built.app, `query { serverConfig { features } }`);
    expect(
      (features.json() as { data: { serverConfig: { features: string[] } } }).data
        .serverConfig.features
    ).toEqual(expect.arrayContaining(['Copilot', 'CopilotEmbedding']));

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
            docId: 'board-e2',
            reuseLatestChat: false,
          },
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
        variables: { options: { sessionId, content: 'summarize the board' } },
      }
    );
    expect(prompts.some(text => text.includes('secret board alpha'))).toBe(true);

    const chats = await gql(
      built.app,
      `query ($workspaceId: String!, $sessionId: String!) {
        currentUser {
          copilot(workspaceId: $workspaceId) {
            quota { limit used }
            session(sessionId: $sessionId) { id promptName }
            chats(pagination: { first: 5 }, options: { sessionId: $sessionId }) {
              totalCount
              edges { node { sessionId messages { role content } } }
            }
          }
        }
      }`,
      { cookies: owner.cookies, variables: { workspaceId, sessionId } }
    );
    const chatBody = chats.json() as {
      data: {
        currentUser: {
          copilot: {
            quota: { used: number };
            chats: { totalCount: number };
          };
        };
      };
      errors?: unknown;
    };
    expect(chatBody.errors).toBeUndefined();
    expect(chatBody.data.currentUser.copilot.chats.totalCount).toBe(1);
    expect(chatBody.data.currentUser.copilot.quota.used).toBeGreaterThan(0);

    const mcp = await gql(
      built.app,
      `mutation ($input: CreateMcpCredentialInput!) {
        createMcpCredential(input: $input) {
          token
          credential { id fingerprint status accessMode }
        }
      }`,
      {
        cookies: owner.cookies,
        variables: {
          input: { workspaceId, name: 'ide', accessMode: 'READ_ONLY' },
        },
      }
    );
    const mcpBody = mcp.json() as {
      data: { createMcpCredential: { token: string } };
      errors?: unknown;
    };
    expect(mcpBody.errors).toBeUndefined();
    const token = mcpBody.data.createMcpCredential.token;
    const hint = await built.app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/mcp`,
      headers: { cookie: owner.cookies },
    });
    expect(hint.statusCode).toBe(200);
    const call = await built.app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/mcp`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'read_document', arguments: { docId: 'board-e2' } },
      },
    });
    expect(call.json()).toMatchObject({
      result: { docId: 'board-e2' },
    });
    expect(String(call.body)).toContain('secret board alpha');

    const caldav = await gql(
      built.app,
      `mutation {
        linkCalDAVAccount(input: {
          providerPresetId: "generic"
          username: "user@example.com"
          password: "app-pass"
          displayName: "Work"
        }) { id provider calendarsCount }
      }`,
      { cookies: owner.cookies }
    );
    const accountId = (
      caldav.json() as {
        data: { linkCalDAVAccount: { id: string; calendarsCount: number } };
      }
    ).data.linkCalDAVAccount.id;
    expect(accountId).toBeTruthy();

    const from = new Date(Date.now() - 3600_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    const accounts = await gql(
      built.app,
      `query {
        currentUser {
          calendarAccounts { id calendars { id } }
        }
      }`,
      { cookies: owner.cookies }
    );
    const subId = (
      accounts.json() as {
        data: {
          currentUser: {
            calendarAccounts: Array<{ calendars: Array<{ id: string }> }>;
          };
        };
      }
    ).data.currentUser.calendarAccounts[0]?.calendars[0]?.id;
    expect(subId).toBeTruthy();

    await gql(
      built.app,
      `mutation ($input: UpdateWorkspaceCalendarsInput!) {
        updateWorkspaceCalendars(input: $input) { id enabled }
      }`,
      {
        cookies: owner.cookies,
        variables: {
          input: {
            workspaceId,
            items: [{ subscriptionId: subId }],
          },
        },
      }
    );
    const events = await gql(
      built.app,
      `query ($workspaceId: String!, $from: DateTime!, $to: DateTime!) {
        workspace(id: $workspaceId) {
          calendars {
            events(from: $from, to: $to) { id title }
          }
        }
      }`,
      { cookies: owner.cookies, variables: { workspaceId, from, to } }
    );
    const eventList = (
      events.json() as {
        data: {
          workspace: { calendars: Array<{ events: Array<{ title: string }> }> };
        };
      }
    ).data.workspace.calendars[0]?.events;
    expect(eventList?.length).toBeGreaterThan(0);

    const byok = await gql(
      built.app,
      `mutation ($input: CreateWorkspaceByokProfileInput!) {
        createWorkspaceByokProfile(input: $input) { profileId provider }
      }`,
      {
        cookies: owner.cookies,
        variables: {
          input: {
            workspaceId,
            provider: 'openai',
            name: 'prod',
            enabled: true,
            credential: 'sk-byok',
            definition: {
              endpoint: { kind: 'provider_default' },
              models: [
                {
                  modelId: 'gpt-4o-mini',
                  enabled: true,
                  capabilities: [
                    {
                      input: ['text'],
                      output: ['text'],
                      features: [],
                      attachmentKinds: [],
                      attachmentSources: [],
                    },
                  ],
                },
              ],
            },
          },
        },
      }
    );
    expect(
      (byok.json() as { data: { createWorkspaceByokProfile: { profileId: string } } })
        .data.createWorkspaceByokProfile.profileId
    ).toBeTruthy();

    const pat = await built.app.inject({
      method: 'POST',
      url: '/api/v2/tokens',
      headers: {
        'content-type': 'application/json',
        cookie: owner.cookies,
      },
      payload: { name: 'ci', scopes: ['read:docs'] },
    });
    const secret = (pat.json() as { token: string }).token;
    const listed = await built.app.inject({
      method: 'GET',
      url: '/api/v2/workspaces',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { items: Array<{ id: string }> }).items[0]?.id).toBe(
      workspaceId
    );

    const ignored = await gql(
      built.app,
      `mutation ($workspaceId: String!) {
        updateWorkspaceEmbeddingIgnoredDocs(workspaceId: $workspaceId, add: ["secret-doc"])
      }`,
      { cookies: owner.cookies, variables: { workspaceId } }
    );
    expect(
      (ignored.json() as { data: { updateWorkspaceEmbeddingIgnoredDocs: number } })
        .data.updateWorkspaceEmbeddingIgnoredDocs
    ).toBe(1);

    const openapi = await built.app.inject({
      method: 'GET',
      url: '/api/v2/openapi.json',
    });
    expect(openapi.statusCode).toBe(200);
    expect((openapi.json() as { openapi: string }).openapi).toBe('3.1.0');
  });
});
