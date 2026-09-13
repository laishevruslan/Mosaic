import type { FastifyRequest } from 'fastify';

import type { AiGatewayService } from '../../application/ai-gateway.js';
import type { AuthService } from '../../application/auth-service.js';
import type { ByokService } from '../../application/byok-service.js';
import { sha256 } from '../../application/crypto.js';
import type { EmbeddingService } from '../../application/embedding-service.js';
import type { WorkspaceService } from '../../application/workspace-service.js';
import type { User } from '../../domain/identity.js';
import { toGraphQLError } from './graphql-error.js';

export const copilotTypeDefs = /* GraphQL */ `
  enum ChatHistoryOrder {
    asc
    desc
  }

  enum AiJobStatus {
    claimed
    failed
    finished
    pending
    running
  }

  enum ByokProvider {
    openai
    anthropic
    fal
    gemini
  }

  enum ByokCustomEndpointMode {
    disabled
    enabled
    unavailable
  }

  enum ByokEndpointKind {
    openai_compatible
    provider_default
  }

  enum ByokOpenAiDialect {
    chat_completions
    responses
  }

  enum ByokModelFeature {
    reasoning
    tool_calling
    web_search
  }

  enum ByokModelInput {
    audio
    file
    image
    text
  }

  enum ByokModelOutput {
    embedding
    image
    object
    rerank
    structured
    text
  }

  enum ByokAttachmentKind {
    audio
    file
    image
  }

  enum ByokAttachmentSource {
    bytes
    data
    file_handle
    url
  }

  enum ByokProbeOperation {
    chat
    embedding
    image
    rerank
    structured
    tool_calling
    transcript
    vision
  }

  enum ByokProbeStatusKind {
    failed
    not_tested
    verified
  }

  input QueryChatHistoriesInput {
    action: Boolean
    fork: Boolean
    limit: Int
    messageOrder: ChatHistoryOrder
    pinned: Boolean
    sessionId: String
    sessionOrder: ChatHistoryOrder
    skip: Int
    withMessages: Boolean
    withPrompt: Boolean
  }

  input QueryChatSessionsInput {
    action: Boolean
    fork: Boolean
    limit: Int
    pinned: Boolean
    skip: Int
  }

  input ForkChatSessionInput {
    workspaceId: String!
    sessionId: String!
    docId: String!
    latestMessageId: String
  }

  input UpdateChatSessionInput {
    sessionId: String!
    docId: String
    pinned: Boolean
    promptName: String
  }

  input DeleteSessionInput {
    workspaceId: String!
    sessionIds: [String!]!
    docId: String
  }

  input SubmitAudioTranscriptionInput {
    quality: TranscriptionQualityInput
    sliceManifest: [AudioSliceManifestItemInput!]
    sourceAudio: TranscriptionSourceAudioInput
  }

  input TranscriptionQualityInput {
    degraded: Boolean
    overflowCount: Int
  }

  input AudioSliceManifestItemInput {
    index: Int
    fileName: String
    mimeType: String
    startSec: Float
    durationSec: Float
    byteSize: Int
  }

  input TranscriptionSourceAudioInput {
    channels: Int
    durationMs: Int
    mimeType: String
    sampleRate: Int
  }

  type CopilotHistoriesTypeEdge {
    cursor: String!
    node: CopilotHistories!
  }

  type PaginatedCopilotHistoriesType {
    edges: [CopilotHistoriesTypeEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CopilotRouteTarget {
    available: Boolean!
    displayName: String!
    id: String!
    minimumTier: String!
  }

  type CopilotRouteOptions {
    choices: [CopilotRouteTarget!]!
    defaultTargetId: String
    routeId: String!
  }

  type CopilotSessionType {
    docId: String
    id: ID!
    parentSessionId: ID
    pinned: Boolean!
    promptName: String!
    title: String
  }

  type TranscriptionQualityType {
    degraded: Boolean
    overflowCount: Int
  }

  type TranscriptionSourceAudioType {
    blobId: String
    channels: Int
    durationMs: Int
    mimeType: String
    sampleRate: Int
  }

  type AudioSliceManifestItemType {
    index: Int
    fileName: String
    mimeType: String
    startSec: Float
    durationSec: Float
    byteSize: Int
  }

  type NormalizedTranscriptSegmentType {
    speaker: String
    startSec: Float
    endSec: Float
    start: String
    end: String
    text: String
  }

  type MeetingActionItemType {
    deadline: String
    description: String!
    owner: String
  }

  type MeetingSummaryV2Type {
    actionItems: [MeetingActionItemType!]!
    attendees: [String!]!
    blockers: [String!]!
    decisions: [String!]!
    durationMinutes: Float!
    keyPoints: [String!]!
    openQuestions: [String!]!
    title: String!
  }

  type TranscriptionItemType {
    speaker: String
    start: String
    end: String
    transcription: String
  }

  type TranscriptionResultType {
    actions: String
    id: ID!
    normalizedSegments: [NormalizedTranscriptSegmentType!]
    normalizedTranscript: String
    quality: TranscriptionQualityType
    sliceManifest: [AudioSliceManifestItemType!]
    sourceAudio: TranscriptionSourceAudioType
    status: AiJobStatus!
    summary: String
    summaryJson: MeetingSummaryV2Type
    title: String
    transcription: [TranscriptionItemType!]
    version: String
  }

  type CopilotWorkspaceArtifact {
    artifactId: String!
    contentHash: String!
    createdAt: DateTime!
    embeddingStatus: String!
    fileName: String!
    mediaType: String!
    size: SafeInt!
    workspaceId: String!
  }

  type CopilotWorkspaceArtifactTypeEdge {
    cursor: String!
    node: CopilotWorkspaceArtifact!
  }

  type PaginatedCopilotWorkspaceArtifactType {
    edges: [CopilotWorkspaceArtifactTypeEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CopilotWorkspaceIgnoredDoc {
    createdAt: DateTime!
    createdBy: String
    createdByAvatar: String
    docCreatedAt: DateTime
    docId: String!
    docUpdatedAt: DateTime
    title: String
    updatedBy: String
  }

  type CopilotWorkspaceIgnoredDocTypeEdge {
    cursor: String!
    node: CopilotWorkspaceIgnoredDoc!
  }

  type PaginatedIgnoredDocsType {
    edges: [CopilotWorkspaceIgnoredDocTypeEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CopilotWorkspaceConfig {
    allIgnoredDocs: [CopilotWorkspaceIgnoredDoc!]!
    artifacts(pagination: PaginationInput!): PaginatedCopilotWorkspaceArtifactType!
    ignoredDocs(pagination: PaginationInput!): PaginatedIgnoredDocsType!
    workspaceId: String!
  }

  type WorkspaceByokCapabilityType {
    attachmentKinds: [ByokAttachmentKind!]!
    attachmentSources: [ByokAttachmentSource!]!
    features: [ByokModelFeature!]!
    input: [ByokModelInput!]!
    output: [ByokModelOutput!]!
  }

  input WorkspaceByokCapabilityInput {
    attachmentKinds: [ByokAttachmentKind!]!
    attachmentSources: [ByokAttachmentSource!]!
    features: [ByokModelFeature!]!
    input: [ByokModelInput!]!
    output: [ByokModelOutput!]!
  }

  type WorkspaceByokCatalogModelType {
    capabilities: [WorkspaceByokCapabilityType!]!
    displayName: String!
    modelId: String!
    recommended: Boolean!
  }

  type WorkspaceByokCatalogProviderType {
    models: [WorkspaceByokCatalogModelType!]!
    provider: ByokProvider!
  }

  type WorkspaceByokCatalogType {
    providers: [WorkspaceByokCatalogProviderType!]!
    version: String!
  }

  type WorkspaceByokEndpointType {
    dialect: ByokOpenAiDialect
    kind: ByokEndpointKind!
    url: String
  }

  input WorkspaceByokEndpointInput {
    dialect: ByokOpenAiDialect
    kind: ByokEndpointKind!
    url: String
  }

  type WorkspaceByokModelDeclarationType {
    capabilities: [WorkspaceByokCapabilityType!]!
    enabled: Boolean!
    modelId: String!
  }

  input WorkspaceByokModelDeclarationInput {
    capabilities: [WorkspaceByokCapabilityInput!]!
    enabled: Boolean!
    modelId: String!
  }

  type WorkspaceByokProfileDefinitionType {
    endpoint: WorkspaceByokEndpointType!
    models: [WorkspaceByokModelDeclarationType!]!
  }

  input WorkspaceByokProfileDefinitionInput {
    endpoint: WorkspaceByokEndpointInput!
    models: [WorkspaceByokModelDeclarationInput!]!
  }

  type WorkspaceByokProbeStatusType {
    errorKind: String
    kind: ByokProbeStatusKind!
    testedAt: DateTime
  }

  type WorkspaceByokModelProbeCheckType {
    operation: ByokProbeOperation!
    status: WorkspaceByokProbeStatusType!
  }

  type WorkspaceByokModelProbeType {
    checks: [WorkspaceByokModelProbeCheckType!]!
    modelId: String!
  }

  type WorkspaceByokValidationType {
    connection: WorkspaceByokProbeStatusType!
    credentialGeneration: SafeInt!
    definitionFingerprint: String!
    models: [WorkspaceByokModelProbeType!]!
  }

  type WorkspaceByokProfileType {
    definition: WorkspaceByokProfileDefinitionType!
    description: String
    enabled: Boolean!
    name: String!
    profileId: ID!
    provider: ByokProvider!
    revision: SafeInt!
    sortOrder: SafeInt!
    validation: WorkspaceByokValidationType
    workspaceId: String!
  }

  type WorkspaceByokPolicyType {
    allowedProviders: [ByokProvider!]!
    customEndpointMode: ByokCustomEndpointMode!
    enabled: Boolean!
    privateEndpointSupported: Boolean!
  }

  type WorkspaceByokSettingsType {
    catalog: WorkspaceByokCatalogType!
    entitled: Boolean!
    localEntitled: Boolean!
    policy: WorkspaceByokPolicyType!
    profiles: [WorkspaceByokProfileType!]!
    serverEntitled: Boolean!
    workspaceId: String!
  }

  type WorkspaceByokUsagePointType {
    date: DateTime!
    featureKind: String!
    totalTokens: SafeInt!
  }

  type WorkspaceByokProbeResultType {
    connection: WorkspaceByokProbeStatusType!
    definitionFingerprint: String!
    models: [WorkspaceByokModelProbeType!]!
    stale: Boolean!
  }

  input CreateWorkspaceByokProfileInput {
    credential: String!
    definition: WorkspaceByokProfileDefinitionInput!
    description: String
    enabled: Boolean!
    name: String!
    provider: ByokProvider!
    workspaceId: String!
  }

  input ReplaceWorkspaceByokProfileInput {
    credential: String
    definition: WorkspaceByokProfileDefinitionInput!
    description: String
    enabled: Boolean!
    expectedRevision: SafeInt!
    name: String!
    profileId: ID!
    workspaceId: String!
  }

  input RotateWorkspaceByokCredentialInput {
    credential: String!
    expectedRevision: SafeInt!
    profileId: ID!
    workspaceId: String!
  }

  input WorkspaceByokProfileOrderInput {
    expectedRevision: SafeInt!
    profileId: ID!
  }

  input ReorderWorkspaceByokProfilesInput {
    profiles: [WorkspaceByokProfileOrderInput!]!
    workspaceId: String!
  }

  input WorkspaceByokProbeCheckInput {
    modelId: String!
    operation: ByokProbeOperation!
  }

  input ProbeWorkspaceByokProfileInput {
    checks: [WorkspaceByokProbeCheckInput!]!
    profileId: ID!
    workspaceId: String!
  }

  input ProbeWorkspaceByokDraftInput {
    checks: [WorkspaceByokProbeCheckInput!]!
    credential: String
    definition: WorkspaceByokProfileDefinitionInput!
    expectedRevision: SafeInt
    profileId: ID
    provider: ByokProvider!
    workspaceId: String!
  }

  input CreateWorkspaceByokLocalLeaseProviderInput {
    credential: String!
    definition: WorkspaceByokProfileDefinitionInput!
    description: String
    enabled: Boolean!
    name: String!
    provider: ByokProvider!
  }

  input CreateWorkspaceByokLocalLeaseInput {
    providers: [CreateWorkspaceByokLocalLeaseProviderInput!]!
    workspaceId: String!
  }

  type CreateWorkspaceByokLocalLeaseResultType {
    expiresAt: DateTime!
    leaseId: String!
  }

  extend type Copilot {
    workspaceId: ID
    chats(
      pagination: PaginationInput!
      docId: String
      options: QueryChatHistoriesInput
    ): PaginatedCopilotHistoriesType!
    histories(docId: String, options: QueryChatHistoriesInput): [CopilotHistories!]!
    routeOptions(promptName: String!): CopilotRouteOptions
    session(sessionId: String!): CopilotSessionType!
    sessions(docId: String, options: QueryChatSessionsInput): [CopilotSessionType!]!
    transcriptTask(taskId: String, blobId: String): TranscriptionResultType
  }

  extend type WorkspaceType {
    enableDocEmbedding: Boolean!
    embedding: CopilotWorkspaceConfig!
    byokSettings: WorkspaceByokSettingsType!
    byokUsage(from: DateTime!, to: DateTime!): [WorkspaceByokUsagePointType!]!
  }

  extend type Mutation {
    forkCopilotSession(options: ForkChatSessionInput!): String!
    updateCopilotSession(options: UpdateChatSessionInput!): String!
    cleanupCopilotSession(options: DeleteSessionInput!): [String!]!
    submitTranscriptTask(
      workspaceId: String!
      blobId: String!
      blob: Upload
      blobs: [Upload!]
      input: SubmitAudioTranscriptionInput
    ): TranscriptionResultType
    retryTranscriptTask(workspaceId: String!, taskId: String!): TranscriptionResultType!
    settleTranscriptTask(workspaceId: String!, taskId: String!): TranscriptionResultType!
    addWorkspaceArtifact(workspaceId: String!, blob: Upload!): CopilotWorkspaceArtifact!
    removeWorkspaceArtifact(workspaceId: String!, artifactId: String!): Boolean!
    updateWorkspaceEmbeddingIgnoredDocs(
      workspaceId: String!
      add: [String!]
      remove: [String!]
    ): Int!
    createWorkspaceByokProfile(input: CreateWorkspaceByokProfileInput!): WorkspaceByokProfileType!
    replaceWorkspaceByokProfile(input: ReplaceWorkspaceByokProfileInput!): WorkspaceByokProfileType!
    rotateWorkspaceByokCredential(input: RotateWorkspaceByokCredentialInput!): WorkspaceByokProfileType!
    deleteWorkspaceByokProfile(workspaceId: String!, profileId: ID!): Boolean!
    reorderWorkspaceByokProfiles(input: ReorderWorkspaceByokProfilesInput!): [WorkspaceByokProfileType!]!
    probeWorkspaceByokProfile(input: ProbeWorkspaceByokProfileInput!): WorkspaceByokProbeResultType!
    probeWorkspaceByokDraft(input: ProbeWorkspaceByokDraftInput!): WorkspaceByokProbeResultType!
    createWorkspaceByokLocalLease(input: CreateWorkspaceByokLocalLeaseInput!): CreateWorkspaceByokLocalLeaseResultType!
  }
`;

function paginate<T>(
  items: T[],
  pagination: { first?: number | null; offset?: number | null; after?: string | null },
  idOf: (item: T) => string
) {
  const offset = Math.max(0, pagination.offset ?? 0);
  const first = Math.min(50, Math.max(1, pagination.first ?? 10));
  const slice = items.slice(offset, offset + first);
  return {
    totalCount: items.length,
    pageInfo: {
      hasNextPage: offset + first < items.length,
      hasPreviousPage: offset > 0,
      startCursor: slice[0] ? idOf(slice[0]) : null,
      endCursor: slice.length ? idOf(slice[slice.length - 1]!) : null,
    },
    edges: slice.map(item => ({ cursor: idOf(item), node: item })),
  };
}

export interface CopilotGraphqlOpts {
  auth: AuthService;
  workspaces: WorkspaceService;
  ai: AiGatewayService;
  embeddings: EmbeddingService;
  byok: ByokService;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

export function copilotResolvers(opts: CopilotGraphqlOpts) {
  const userOf = async (ctx: { request?: FastifyRequest }): Promise<User> =>
    opts.auth.requireUser(opts.requestOf(ctx)?.authSession ?? null);

  return {
    Copilot: {
      workspaceId: (parent: { workspaceId?: string | null }) =>
        parent.workspaceId ?? null,
      chats: async (
        parent: { userId: string; workspaceId?: string | null },
        args: {
          pagination: { first?: number | null; offset?: number | null; after?: string | null };
          docId?: string | null;
          options?: Parameters<AiGatewayService['chats']>[2]['options'];
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (!parent.workspaceId) {
            return {
              totalCount: 0,
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: null,
                endCursor: null,
              },
              edges: [],
            };
          }
          return opts.ai.chats(user, parent.workspaceId, {
            pagination: args.pagination,
            ...(args.docId !== undefined ? { docId: args.docId } : {}),
            ...(args.options ? { options: args.options } : {}),
          });
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      histories: async (
        parent: { workspaceId?: string | null },
        args: {
          docId?: string | null;
          options?: Parameters<AiGatewayService['chats']>[2]['options'];
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (!parent.workspaceId) {
            return [];
          }
          const page = await opts.ai.chats(user, parent.workspaceId, {
            pagination: { first: args.options?.limit ?? 20, offset: args.options?.skip ?? 0 },
            ...(args.docId !== undefined ? { docId: args.docId } : {}),
            ...(args.options ? { options: args.options } : {}),
          });
          return page.edges.map(edge => edge.node);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      routeOptions: async (
        parent: { workspaceId?: string | null },
        args: { promptName: string }
      ) => opts.ai.routeOptions(args.promptName, parent.workspaceId),
      session: async (
        _parent: unknown,
        args: { sessionId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.ai.gqlSession(await opts.ai.getSession(user, args.sessionId));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      sessions: async (
        parent: { workspaceId?: string | null },
        args: { docId?: string | null },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (!parent.workspaceId) {
            return [];
          }
          const sessions = await opts.ai.listSessions(user, parent.workspaceId);
          return sessions
            .filter(session => (args.docId ? session.docId === args.docId : true))
            .map(session => opts.ai.gqlSession(session));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      transcriptTask: async (
        parent: { workspaceId?: string | null },
        args: { taskId?: string | null; blobId?: string | null },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (!parent.workspaceId) {
            return null;
          }
          const task = await opts.ai.transcriptTask(user, parent.workspaceId, args);
          return task ? opts.ai.gqlTranscript(task) : null;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    CopilotWorkspaceConfig: {
      allIgnoredDocs: async (
        parent: { workspaceId: string },
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        const user = await userOf(ctx);
        const docs = await opts.embeddings.listIgnored(user, parent.workspaceId);
        return docs.map(doc => ({
          docId: doc.docId,
          createdAt: doc.createdAt,
          createdBy: doc.createdBy,
          createdByAvatar: null,
          docCreatedAt: null,
          docUpdatedAt: null,
          title: null,
          updatedBy: null,
        }));
      },
      artifacts: async (
        parent: { workspaceId: string },
        args: { pagination: { first?: number | null; offset?: number | null } },
        ctx: { request?: FastifyRequest }
      ) => {
        const user = await userOf(ctx);
        const items = await opts.embeddings.listArtifacts(user, parent.workspaceId);
        return paginate(items, args.pagination, item => item.artifactId);
      },
      ignoredDocs: async (
        parent: { workspaceId: string },
        args: { pagination: { first?: number | null; offset?: number | null } },
        ctx: { request?: FastifyRequest }
      ) => {
        const user = await userOf(ctx);
        const docs = await opts.embeddings.listIgnored(user, parent.workspaceId);
        const nodes = docs.map(doc => ({
          docId: doc.docId,
          createdAt: doc.createdAt,
          createdBy: doc.createdBy,
          createdByAvatar: null,
          docCreatedAt: null,
          docUpdatedAt: null,
          title: null,
          updatedBy: null,
        }));
        return paginate(nodes, args.pagination, item => item.docId);
      },
    },
    WorkspaceType: {
      enableDocEmbedding: (parent: { enableDocEmbedding?: boolean }) =>
        parent.enableDocEmbedding ?? false,
      embedding: (parent: { id: string }) => ({ workspaceId: parent.id }),
      byokSettings: async (
        parent: { id: string },
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const settings = await opts.byok.settings(user, parent.id);
          return {
            ...settings,
            profiles: settings.profiles.map(profile => opts.byok.gqlProfile(profile)),
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      byokUsage: async (
        parent: { id: string },
        args: { from: string | Date; to: string | Date },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.usage(
            user,
            parent.id,
            new Date(args.from),
            new Date(args.to)
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    Mutation: {
      forkCopilotSession: async (
        _root: unknown,
        args: {
          options: {
            workspaceId: string;
            sessionId: string;
            docId: string;
            latestMessageId?: string | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const session = await opts.ai.forkSession(user, args.options);
          return session.id;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateCopilotSession: async (
        _root: unknown,
        args: {
          options: {
            sessionId: string;
            docId?: string | null;
            pinned?: boolean | null;
            promptName?: string | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const session = await opts.ai.updateSession(user, args.options);
          return session.id;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      cleanupCopilotSession: async (
        _root: unknown,
        args: {
          options: { workspaceId: string; sessionIds: string[]; docId?: string | null };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.ai.cleanupSessions(user, args.options);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      submitTranscriptTask: async (
        _root: unknown,
        args: { workspaceId: string; blobId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const task = await opts.ai.submitTranscript(user, {
            workspaceId: args.workspaceId,
            blobId: args.blobId,
          });
          return opts.ai.gqlTranscript(task);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      retryTranscriptTask: async (
        _root: unknown,
        args: { workspaceId: string; taskId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.ai.gqlTranscript(
            await opts.ai.retryTranscript(user, args.workspaceId, args.taskId)
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      settleTranscriptTask: async (
        _root: unknown,
        args: { workspaceId: string; taskId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.ai.gqlTranscript(
            await opts.ai.settleTranscript(user, args.workspaceId, args.taskId)
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      addWorkspaceArtifact: async (
        _root: unknown,
        args: { workspaceId: string; blob: unknown },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const blob = args.blob as {
            name?: string;
            type?: string;
            size?: number;
            arrayBuffer?: () => Promise<ArrayBuffer>;
          };
          let hash = 'empty';
          let size = Number(blob.size ?? 0);
          if (typeof blob.arrayBuffer === 'function') {
            const buf = Buffer.from(await blob.arrayBuffer());
            hash = sha256(buf.toString('hex'));
            size = buf.byteLength;
          }
          const artifact = await opts.embeddings.addArtifact(user, args.workspaceId, {
            fileName: blob.name ?? 'artifact',
            mediaType: blob.type ?? 'application/octet-stream',
            size,
            contentHash: hash,
          });
          return artifact;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      removeWorkspaceArtifact: async (
        _root: unknown,
        args: { workspaceId: string; artifactId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.embeddings.removeArtifact(
            user,
            args.workspaceId,
            args.artifactId
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateWorkspaceEmbeddingIgnoredDocs: async (
        _root: unknown,
        args: { workspaceId: string; add?: string[] | null; remove?: string[] | null },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          let count = 0;
          if (args.add?.length) {
            count += await opts.embeddings.addIgnored(user, args.workspaceId, args.add);
          }
          if (args.remove?.length) {
            count += await opts.embeddings.removeIgnored(
              user,
              args.workspaceId,
              args.remove
            );
          }
          return count;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      createWorkspaceByokProfile: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            provider: 'openai' | 'anthropic' | 'fal' | 'gemini';
            name: string;
            description?: string | null;
            enabled: boolean;
            credential: string;
            definition: Record<string, unknown>;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.gqlProfile(await opts.byok.create(user, args.input));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      replaceWorkspaceByokProfile: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            profileId: string;
            expectedRevision: number;
            name: string;
            description?: string | null;
            enabled: boolean;
            credential?: string | null;
            definition: Record<string, unknown>;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.gqlProfile(await opts.byok.replace(user, args.input));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      rotateWorkspaceByokCredential: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            profileId: string;
            expectedRevision: number;
            credential: string;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.gqlProfile(await opts.byok.rotate(user, args.input));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      deleteWorkspaceByokProfile: async (
        _root: unknown,
        args: { workspaceId: string; profileId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.remove(user, args.workspaceId, args.profileId);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      reorderWorkspaceByokProfiles: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            profiles: Array<{ profileId: string; expectedRevision: number }>;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const profiles = await opts.byok.reorder(user, args.input);
          return profiles.map(profile => opts.byok.gqlProfile(profile));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      probeWorkspaceByokProfile: async (
        _root: unknown,
        args: { input: { workspaceId: string; profileId: string } },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.probe(user, args.input.workspaceId, {
            profileId: args.input.profileId,
          });
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      probeWorkspaceByokDraft: async (
        _root: unknown,
        args: {
          input: { workspaceId: string; definition: Record<string, unknown> };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.probe(user, args.input.workspaceId, args.input.definition);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      createWorkspaceByokLocalLease: async (
        _root: unknown,
        args: { input: { workspaceId: string } },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.byok.lease(user, args.input.workspaceId);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
