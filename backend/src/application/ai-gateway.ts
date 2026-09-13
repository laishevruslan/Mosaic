import type { JobWorker } from '../adapters/jobs/worker.js';
import {
  estimateTokens,
  routeForPrompt,
  type CopilotMessageRecord,
  type CopilotSessionRecord,
  type CopilotStreamObject,
  type CopilotTranscriptTask,
} from '../domain/ai.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { AiStore, Clock, HttpFetcher } from '../domain/ports.js';
import type { AuditService } from './audit-service.js';
import type { ByokService } from './byok-service.js';
import type { EmbeddingService } from './embedding-service.js';
import type { WorkspaceService } from './workspace-service.js';
import type { DlpService } from './dlp-service.js';

export interface AiSettings {
  baseUrl: string;
  apiKey?: string;
  model: string;
  quotaLimit?: number | null;
}

const CHART_TYPES = ['bar', 'line', 'pie', 'scatter'] as const;

export class AiGatewayService {
  constructor(
    private readonly store: AiStore,
    private readonly clock: Clock,
    private readonly settings: AiSettings,
    private readonly fetch: HttpFetcher = globalThis.fetch,
    private readonly audit?: AuditService,
    private readonly workspaces?: WorkspaceService,
    private readonly embeddings?: EmbeddingService,
    private readonly byok?: ByokService,
    private readonly jobs?: JobWorker,
    private readonly dlp?: DlpService
  ) {}

  get enabled(): boolean {
    return Boolean(this.settings.apiKey);
  }

  async embeddingAdvertised(): Promise<boolean> {
    return Boolean(await this.embeddings?.hasIndexedAny());
  }

  async quota(user: User): Promise<{ limit: number | null; used: number }> {
    const used = await this.store.getCopilotTokenUsage(user.id);
    if (!this.enabled) {
      return { limit: 0, used };
    }
    return { limit: this.settings.quotaLimit ?? null, used };
  }

  async createSession(
    user: User,
    input: {
      workspaceId: string;
      docId?: string | null;
      promptName: string;
      pinned?: boolean;
      reuseLatestChat?: boolean | null;
    }
  ): Promise<CopilotSessionRecord> {
    await this.assertWorkspace(user, input.workspaceId);
    this.assertEnabled();
    if (input.reuseLatestChat !== false) {
      const existing = await this.store.listCopilotSessions(
        user.id,
        input.workspaceId
      );
      const match = existing.find(
        session =>
          session.promptName === input.promptName &&
          (input.docId ? session.docId === input.docId : true)
      );
      if (match) {
        return match;
      }
    }
    const now = this.clock.now();
    const session = await this.store.createCopilotSession({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      userId: user.id,
      docId: input.docId ?? null,
      promptName: input.promptName,
      title: null,
      pinned: input.pinned ?? false,
      parentSessionId: null,
      action: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.audit?.record({
      workspaceId: input.workspaceId,
      actorId: user.id,
      action: 'ai.session_create',
      targetType: 'copilot_session',
      targetId: session.id,
    });
    return session;
  }

  async getSession(
    user: User,
    sessionId: string
  ): Promise<CopilotSessionRecord> {
    const session = await this.store.getCopilotSession(sessionId);
    if (!session || session.userId !== user.id) {
      throw errors.badRequest('Copilot session not found.');
    }
    return session;
  }

  async listSessions(
    user: User,
    workspaceId: string
  ): Promise<CopilotSessionRecord[]> {
    await this.assertWorkspace(user, workspaceId);
    return this.store.listCopilotSessions(user.id, workspaceId);
  }

  async updateSession(
    user: User,
    input: {
      sessionId: string;
      docId?: string | null;
      pinned?: boolean | null;
      promptName?: string | null;
    }
  ): Promise<CopilotSessionRecord> {
    const session = await this.getSession(user, input.sessionId);
    return this.store.updateCopilotSession(session.id, {
      ...(input.docId !== undefined ? { docId: input.docId } : {}),
      ...(input.pinned != null ? { pinned: input.pinned } : {}),
      ...(input.promptName ? { promptName: input.promptName } : {}),
      updatedAt: this.clock.now(),
    });
  }

  async forkSession(
    user: User,
    input: {
      workspaceId: string;
      sessionId: string;
      docId: string;
      latestMessageId?: string | null;
    }
  ): Promise<CopilotSessionRecord> {
    await this.assertWorkspace(user, input.workspaceId);
    const source = await this.getSession(user, input.sessionId);
    const messages = await this.store.listCopilotMessages(source.id);
    const cutoff = input.latestMessageId
      ? messages.findIndex(message => message.id === input.latestMessageId)
      : messages.length - 1;
    const keep = cutoff >= 0 ? messages.slice(0, cutoff + 1) : messages;
    const now = this.clock.now();
    const session = await this.store.createCopilotSession({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      userId: user.id,
      docId: input.docId,
      promptName: source.promptName,
      title: source.title,
      pinned: false,
      parentSessionId: source.id,
      action: null,
      createdAt: now,
      updatedAt: now,
    });
    for (const message of keep) {
      await this.store.appendCopilotMessage({
        ...message,
        id: crypto.randomUUID(),
        sessionId: session.id,
        createdAt: this.clock.now(),
      });
    }
    return session;
  }

  async cleanupSessions(
    user: User,
    input: { workspaceId: string; sessionIds: string[]; docId?: string | null }
  ): Promise<string[]> {
    await this.assertWorkspace(user, input.workspaceId);
    const owned: string[] = [];
    for (const id of input.sessionIds) {
      const session = await this.store.getCopilotSession(id);
      if (
        session &&
        session.userId === user.id &&
        session.workspaceId === input.workspaceId &&
        (input.docId ? session.docId === input.docId : true)
      ) {
        owned.push(id);
      }
    }
    return this.store.deleteCopilotSessions(owned);
  }

  async history(sessionId: string): Promise<{
    session: CopilotSessionRecord;
    messages: CopilotMessageRecord[];
  }> {
    const session = await this.store.getCopilotSession(sessionId);
    if (!session) {
      throw errors.badRequest('Copilot session not found.');
    }
    return {
      session,
      messages: await this.store.listCopilotMessages(sessionId),
    };
  }

  async chats(
    user: User,
    workspaceId: string,
    args: {
      docId?: string | null;
      pagination?: { first?: number | null; offset?: number | null; after?: string | null };
      options?: {
        action?: boolean | null;
        fork?: boolean | null;
        pinned?: boolean | null;
        sessionId?: string | null;
        sessionOrder?: 'asc' | 'desc' | null;
        withMessages?: boolean | null;
        messageOrder?: 'asc' | 'desc' | null;
        limit?: number | null;
        skip?: number | null;
      } | null;
    }
  ) {
    await this.assertWorkspace(user, workspaceId);
    let sessions = await this.store.listCopilotSessions(user.id, workspaceId);
    if (args.docId) {
      sessions = sessions.filter(session => session.docId === args.docId);
    } else if (args.docId === null) {
      sessions = sessions.filter(session => session.docId == null);
    }
    const options = args.options ?? {};
    if (options.sessionId) {
      sessions = sessions.filter(session => session.id === options.sessionId);
    }
    if (options.pinned) {
      sessions = sessions.filter(session => session.pinned);
    }
    if (options.fork === false) {
      sessions = sessions.filter(session => !session.parentSessionId);
    }
    if (options.action === false) {
      sessions = sessions.filter(session => !session.action);
    }
    sessions.sort((a, b) => {
      const delta = a.updatedAt.getTime() - b.updatedAt.getTime();
      return options.sessionOrder === 'asc' ? delta : -delta;
    });
    const offset = Math.max(
      0,
      args.pagination?.offset ?? options.skip ?? 0
    );
    const first = Math.min(
      50,
      Math.max(1, args.pagination?.first ?? options.limit ?? 10)
    );
    const slice = sessions.slice(offset, offset + first);
    const withMessages = options.withMessages !== false;
    const nodes = await Promise.all(
      slice.map(async session => {
        const messages = withMessages
          ? await this.store.listCopilotMessages(session.id)
          : [];
        const ordered =
          options.messageOrder === 'desc' ? [...messages].reverse() : messages;
        return this.gqlHistory(session, ordered);
      })
    );
    const hasNextPage = offset + first < sessions.length;
    return {
      totalCount: sessions.length,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: offset > 0,
        startCursor: slice[0]?.id ?? null,
        endCursor: slice[slice.length - 1]?.id ?? null,
      },
      edges: nodes.map(node => ({ cursor: node.sessionId, node })),
    };
  }

  async routeOptions(promptName: string, workspaceId?: string | null) {
    const byok = workspaceId
      ? await this.byok?.settings
      : undefined;
    void byok;
    const hasByok = Boolean(
      workspaceId && (await this.byok?.activeCredential(workspaceId))
    );
    return {
      routeId: routeForPrompt(promptName),
      defaultTargetId: hasByok ? 'byok' : 'instance',
      choices: [
        {
          id: 'instance',
          displayName: 'Mosaic instance',
          minimumTier: 'free',
          available: this.enabled,
        },
        {
          id: 'byok',
          displayName: 'Workspace BYOK',
          minimumTier: 'team',
          available: hasByok,
        },
      ],
    };
  }

  async chat(
    user: User,
    sessionId: string,
    content: string
  ): Promise<CopilotMessageRecord> {
    this.assertEnabled();
    const session = await this.getSession(user, sessionId);
    await this.assertQuota(user, content);
    const now = this.clock.now();
    await this.store.appendCopilotMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content,
      attachments: null,
      streamObjects: null,
      createdAt: now,
    });
    const reply = await this.completeForSession(user, session, content);
    const assistant = await this.store.appendCopilotMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: 'assistant',
      content: reply,
      attachments: null,
      streamObjects: [{ type: 'textDelta', textDelta: reply }],
      createdAt: this.clock.now(),
    });
    await this.store.addCopilotTokenUsage(
      user.id,
      estimateTokens(content) + estimateTokens(reply)
    );
    await this.audit?.record({
      workspaceId: session.workspaceId,
      actorId: user.id,
      action: 'ai.completion',
      targetType: 'copilot_session',
      targetId: session.id,
      metadata: { promptName: session.promptName, route: routeForPrompt(session.promptName) },
    });
    return assistant;
  }

  async *streamChat(
    user: User,
    sessionId: string,
    content: string
  ): AsyncGenerator<CopilotStreamObject> {
    const message = await this.chat(user, sessionId, content);
    const delta = message.content;
    const size = Math.max(8, Math.ceil(delta.length / 6));
    for (let i = 0; i < delta.length; i += size) {
      yield { type: 'textDelta', textDelta: delta.slice(i, i + size) };
    }
    yield { type: 'finish', result: { messageId: message.id } };
  }

  async kanban(prompt: string): Promise<{
    columns: Array<{ name: string }>;
    rows: Array<Record<string, string>>;
  }> {
    this.assertEnabled();
    const raw = await this.complete(
      [
        {
          role: 'system',
          content:
            'Return JSON only: {"columns":[{"name":"To do"},{"name":"In progress"},{"name":"Done"}],"rows":[{"title":"...","status":"To do"}]}. Max 50 rows.',
        },
        { role: 'user', content: prompt },
      ],
      null
    );
    try {
      const parsed = JSON.parse(raw) as {
        columns?: Array<{ name: string }>;
        rows?: Array<Record<string, string>>;
      };
      return {
        columns: parsed.columns ?? [
          { name: 'To do' },
          { name: 'In progress' },
          { name: 'Done' },
        ],
        rows: (parsed.rows ?? []).slice(0, 50),
      };
    } catch {
      return {
        columns: [{ name: 'To do' }, { name: 'In progress' }, { name: 'Done' }],
        rows: [{ title: prompt.slice(0, 80), status: 'To do' }],
      };
    }
  }

  async chart(prompt: string): Promise<{
    type: (typeof CHART_TYPES)[number];
    title: string;
    categories: string[];
    series: Array<{ name: string; data: number[] }>;
  }> {
    this.assertEnabled();
    const raw = await this.complete(
      [
        {
          role: 'system',
          content:
            'Return JSON only: {"type":"bar","title":"...","categories":["A"],"series":[{"name":"s","data":[1]}]}. type must be bar|line|pie|scatter.',
        },
        { role: 'user', content: prompt },
      ],
      null
    );
    try {
      const parsed = JSON.parse(raw) as {
        type?: string;
        title?: string;
        categories?: string[];
        series?: Array<{ name?: string; data?: number[] }>;
      };
      const type = CHART_TYPES.includes(
        parsed.type as (typeof CHART_TYPES)[number]
      )
        ? (parsed.type as (typeof CHART_TYPES)[number])
        : 'bar';
      return {
        type,
        title: (parsed.title ?? prompt).slice(0, 80),
        categories: (parsed.categories ?? ['A', 'B']).slice(0, 24),
        series: (parsed.series ?? [{ name: 'Series', data: [1, 2] }]).map(
          item => ({
            name: (item.name ?? 'Series').slice(0, 40),
            data: (item.data ?? [0]).map(value => Number(value) || 0).slice(0, 24),
          })
        ),
      };
    } catch {
      return {
        type: 'bar',
        title: prompt.slice(0, 80),
        categories: ['A', 'B'],
        series: [{ name: 'Series', data: [1, 2] }],
      };
    }
  }

  async submitTranscript(
    user: User,
    input: { workspaceId: string; blobId: string }
  ): Promise<CopilotTranscriptTask> {
    await this.assertWorkspace(user, input.workspaceId);
    this.assertEnabled();
    const now = this.clock.now();
    const task = await this.store.createTranscriptTask({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      userId: user.id,
      blobId: input.blobId,
      status: 'pending',
      title: null,
      summary: null,
      transcript: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.jobs?.enqueue('copilot.transcript', { taskId: task.id });
    return task;
  }

  async handleTranscriptJob(payload: Record<string, unknown>): Promise<void> {
    const taskId = typeof payload.taskId === 'string' ? payload.taskId : null;
    if (!taskId) {
      return;
    }
    const task = await this.store.getTranscriptTask(taskId);
    if (!task) {
      return;
    }
    await this.store.updateTranscriptTask(taskId, {
      status: 'finished',
      title: 'Transcript',
      summary: 'Speech-to-text is not configured; placeholder transcript.',
      transcript: 'Placeholder transcript. Connect a speech provider to replace this.',
      updatedAt: this.clock.now(),
    });
  }

  async transcriptTask(
    user: User,
    workspaceId: string,
    args: { taskId?: string | null; blobId?: string | null }
  ): Promise<CopilotTranscriptTask | null> {
    await this.assertWorkspace(user, workspaceId);
    if (args.taskId) {
      const task = await this.store.getTranscriptTask(args.taskId);
      return task && task.userId === user.id ? task : null;
    }
    if (args.blobId) {
      return this.store.findTranscriptTaskByBlob(workspaceId, args.blobId);
    }
    return null;
  }

  async retryTranscript(
    user: User,
    workspaceId: string,
    taskId: string
  ): Promise<CopilotTranscriptTask> {
    const task = await this.transcriptTask(user, workspaceId, { taskId });
    if (!task) {
      throw errors.badRequest('Transcript task not found.');
    }
    const updated = await this.store.updateTranscriptTask(taskId, {
      status: 'pending',
      updatedAt: this.clock.now(),
    });
    await this.jobs?.enqueue('copilot.transcript', { taskId });
    return updated;
  }

  async settleTranscript(
    user: User,
    workspaceId: string,
    taskId: string
  ): Promise<CopilotTranscriptTask> {
    const task = await this.transcriptTask(user, workspaceId, { taskId });
    if (!task) {
      throw errors.badRequest('Transcript task not found.');
    }
    if (task.status === 'finished') {
      return task;
    }
    return this.store.updateTranscriptTask(taskId, {
      status: 'claimed',
      updatedAt: this.clock.now(),
    });
  }

  gqlHistory(session: CopilotSessionRecord, messages: CopilotMessageRecord[]) {
    return {
      sessionId: session.id,
      workspaceId: session.workspaceId,
      docId: session.docId,
      parentSessionId: session.parentSessionId,
      promptName: session.promptName,
      action: session.action,
      pinned: session.pinned,
      title: session.title,
      messages: messages.map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        attachments: message.attachments,
        scopeSnapshot: null,
        streamObjects: message.streamObjects,
        createdAt: message.createdAt,
      })),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  gqlSession(session: CopilotSessionRecord) {
    return {
      id: session.id,
      docId: session.docId,
      parentSessionId: session.parentSessionId,
      pinned: session.pinned,
      promptName: session.promptName,
      title: session.title,
    };
  }

  gqlTranscript(task: CopilotTranscriptTask) {
    const text = task.transcript ?? '';
    return {
      id: task.id,
      status: task.status,
      title: task.title,
      summary: task.summary,
      actions: null,
      sourceAudio: task.blobId
        ? {
            blobId: task.blobId,
            mimeType: null,
            durationMs: null,
            sampleRate: null,
            channels: null,
          }
        : null,
      quality: { degraded: true, overflowCount: 0 },
      sliceManifest: [],
      normalizedSegments: text
        ? [
            {
              speaker: 'speaker-1',
              startSec: 0,
              endSec: 1,
              start: '0',
              end: '1',
              text,
            },
          ]
        : [],
      normalizedTranscript: text || null,
      summaryJson: task.summary
        ? {
            title: task.title ?? 'Transcript',
            durationMinutes: 0,
            attendees: [],
            keyPoints: [task.summary],
            actionItems: [],
            decisions: [],
            openQuestions: [],
            blockers: [],
          }
        : null,
      transcription: text
        ? [
            {
              speaker: 'speaker-1',
              start: '0',
              end: '1',
              transcription: text,
            },
          ]
        : [],
      version: 'placeholder',
    };
  }

  private async completeForSession(
    _user: User,
    session: CopilotSessionRecord,
    content: string
  ): Promise<string> {
    const route = routeForPrompt(session.promptName);
    const rag =
      route !== 'embed' && this.embeddings
        ? await this.embeddings.retrieve(session.workspaceId, content)
        : [];
    const context = rag
      .map(chunk => `Doc ${chunk.docId}: ${chunk.text}`)
      .join('\n')
      .slice(0, 4000);
    const system = [
      `Mosaic assistant. Prompt: ${session.promptName}. Route: ${route}.`,
      context ? `Workspace context:\n${context}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return this.complete(
      [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
      session.workspaceId
    );
  }

  private async complete(
    messages: Array<{ role: string; content: string }>,
    workspaceId: string | null
  ): Promise<string> {
    const overlay = workspaceId
      ? await this.byok?.activeCredential(workspaceId)
      : null;
    const apiKey = overlay?.apiKey ?? this.settings.apiKey;
    const baseUrl = overlay?.baseUrl ?? this.settings.baseUrl;
    if (!apiKey) {
      throw errors.copilotDisabled();
    }
    const payload = this.dlp?.applyMessages(messages, { workspaceId }) ?? messages;
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await this.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: payload,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      throw errors.actionForbidden('AI provider rejected the request.');
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? '';
  }

  private async assertWorkspace(user: User, workspaceId: string): Promise<void> {
    await this.workspaces?.get(user, workspaceId);
  }

  private async assertQuota(user: User, content: string): Promise<void> {
    const used = await this.store.getCopilotTokenUsage(user.id);
    const limit = this.settings.quotaLimit;
    if (limit != null && used + estimateTokens(content) > limit) {
      throw errors.copilotQuotaExceeded();
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw errors.copilotDisabled();
    }
  }
}
