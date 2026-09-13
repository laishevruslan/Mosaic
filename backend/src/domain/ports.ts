import type { AuditEvent, AuditQuery } from './audit.js';
import type {
  CopilotMessageRecord,
  CopilotSessionRecord,
  CopilotTranscriptTask,
} from './ai.js';
import type { ApiToken } from './api-token.js';
import type { ByokLease, ByokProfile, ByokUsagePoint } from './byok.js';
import type {
  CalendarAccount,
  CalendarEvent,
  CalendarSubscription,
  WorkspaceCalendar,
  WorkspaceCalendarItem,
} from './calendar.js';
import type {
  EmbeddingArtifact,
  EmbeddingChunk,
  EmbeddingIgnoredDoc,
  EmbeddingProgress,
} from './embedding.js';
import type { McpCredential } from './mcp.js';
import type {
  BlobUploadPart,
  BlobUploadSession,
  DocHistoryRecord,
  StoredBlob,
} from './blob.js';
import type {
  CommentChangeRecord,
  CommentRecord,
  CommentReplyRecord,
  Pagination,
} from './comment.js';
import type {
  DocumentRecord,
  DocLifecycle,
  SpaceType,
  StoredDocUpdate,
} from './doc.js';
import type {
  Credential,
  Session,
  User,
  UserListFilter,
  Workspace,
  WorkspaceListFilter,
  WorkspaceMember,
  WorkspaceRole,
} from './identity.js';
import type {
  Organization,
  OrganizationIdp,
  OrgDomain,
  OrgMember,
  OrgRole,
} from './org.js';
import type { ScimGroup, ScimListQuery, ScimToken, ScimUser } from './scim.js';
import type {
  MfaChallenge,
  RecoveryCode,
  TotpCredential,
  WebAuthnCredential,
} from './mfa.js';
import type {
  WorkspaceInvitation,
  WorkspaceInviteLink,
  WorkspacePatch,
} from './membership.js';
import type { OauthAccount } from './sso.js';
import type { SecurityPolicy } from './security.js';
import type { PublicDoc } from './share.js';
import type { JobRecord } from './jobs.js';
import type {
  MailMessage,
  NotificationPrefs,
  NotificationRecord,
  OutboxEmail,
} from './notify.js';
import type { WorkspaceWebhook } from './webhook.js';

export type HttpFetcher = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

export interface Clock {
  now(): Date;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface IdentityStore {
  countUsers(): Promise<number>;
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  createUser(user: User, passwordHash: string | null): Promise<User>;
  updateUser(
    id: string,
    patch: Partial<
      Pick<
        User,
        'name' | 'avatarUrl' | 'emailVerified' | 'features' | 'disabled' | 'email'
      >
    >
  ): Promise<User>;
  listUsers(filter: UserListFilter): Promise<User[]>;
  countUsersFiltered(filter: Omit<UserListFilter, 'skip' | 'take'>): Promise<number>;
  deleteUser(id: string): Promise<boolean>;
  getCredential(userId: string): Promise<Credential | null>;
  setCredential(userId: string, passwordHash: string, at: Date): Promise<void>;
  deleteCredential(userId: string): Promise<void>;

  createSession(session: Session): Promise<Session>;
  findSessionById(id: string): Promise<Session | null>;
  findSessionByTokenHash(hash: string): Promise<Session | null>;
  findSessionByAccessHash(hash: string): Promise<Session | null>;
  findSessionByRefreshHash(hash: string): Promise<Session | null>;
  findSessionByExchangeHash(hash: string): Promise<Session | null>;
  listSessionsByUser(userId: string): Promise<Session[]>;
  updateSession(id: string, patch: Partial<Session>): Promise<Session>;
  revokeSession(id: string, at: Date): Promise<void>;
  revokeOtherSessions(
    userId: string,
    exceptId: string,
    at: Date
  ): Promise<number>;
  revokeAllSessions(userId: string, at: Date): Promise<number>;
}

export interface WorkspaceStore {
  createWorkspace(workspace: Workspace, ownerId: string): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace | null>;
  listWorkspacesForUser(userId: string): Promise<Workspace[]>;
  listWorkspaceIds(): Promise<string[]>;
  listAllWorkspaces(filter: WorkspaceListFilter): Promise<Workspace[]>;
  countAllWorkspaces(
    filter: Omit<WorkspaceListFilter, 'skip' | 'take'>
  ): Promise<number>;
  deleteWorkspace(id: string): Promise<boolean>;
  updateWorkspace(id: string, patch: WorkspacePatch): Promise<Workspace>;
  getMember(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMember | null>;
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  countMembers(workspaceId: string): Promise<number>;
  getOwner(workspaceId: string): Promise<User | null>;
  addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    at: Date,
    inviteId?: string
  ): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<void>;
}

export interface MembershipStore {
  createInvitation(invite: WorkspaceInvitation): Promise<WorkspaceInvitation>;
  getInvitation(id: string): Promise<WorkspaceInvitation | null>;
  findInvitationByEmail(
    workspaceId: string,
    email: string
  ): Promise<WorkspaceInvitation | null>;
  listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]>;
  updateInvitation(
    id: string,
    patch: Partial<
      Pick<WorkspaceInvitation, 'status' | 'inviteeId' | 'acceptedAt'>
    >
  ): Promise<WorkspaceInvitation>;
  deleteInvitation(id: string): Promise<void>;
  upsertInviteLink(link: WorkspaceInviteLink): Promise<WorkspaceInviteLink>;
  getInviteLink(workspaceId: string): Promise<WorkspaceInviteLink | null>;
  getInviteLinkByToken(token: string): Promise<WorkspaceInviteLink | null>;
  deleteInviteLink(workspaceId: string): Promise<boolean>;
}

export interface ShareStore {
  publishDoc(doc: PublicDoc): Promise<PublicDoc>;
  getPublicDoc(workspaceId: string, docId: string): Promise<PublicDoc | null>;
  listPublicDocs(workspaceId: string): Promise<PublicDoc[]>;
  listAllPublicDocs(): Promise<PublicDoc[]>;
  revokePublicDoc(
    workspaceId: string,
    docId: string
  ): Promise<PublicDoc | null>;
}

export interface CommentStore {
  createComment(comment: CommentRecord): Promise<CommentRecord>;
  getComment(id: string): Promise<CommentRecord | null>;
  listComments(
    workspaceId: string,
    docId: string,
    pagination?: Pagination
  ): Promise<{
    items: CommentRecord[];
    totalCount: number;
    hasNextPage: boolean;
  }>;
  updateComment(
    id: string,
    patch: Partial<Pick<CommentRecord, 'content' | 'resolved' | 'updatedAt'>>
  ): Promise<CommentRecord>;
  deleteComment(id: string): Promise<boolean>;
  createReply(reply: CommentReplyRecord): Promise<CommentReplyRecord>;
  getReply(id: string): Promise<CommentReplyRecord | null>;
  listReplies(commentId: string): Promise<CommentReplyRecord[]>;
  listRepliesForComments(commentIds: string[]): Promise<CommentReplyRecord[]>;
  updateReply(
    id: string,
    patch: Partial<Pick<CommentReplyRecord, 'content' | 'updatedAt'>>
  ): Promise<CommentReplyRecord>;
  deleteReply(id: string): Promise<boolean>;
  appendCommentChange(
    change: Omit<CommentChangeRecord, 'id'>
  ): Promise<CommentChangeRecord>;
  listCommentChanges(
    workspaceId: string,
    docId: string,
    pagination?: Pagination
  ): Promise<{
    items: CommentChangeRecord[];
    totalCount: number;
    hasNextPage: boolean;
  }>;
}

export interface DocStore {
  getDocument(
    spaceType: SpaceType,
    spaceId: string,
    docId: string
  ): Promise<DocumentRecord | null>;
  upsertDocument(record: DocumentRecord): Promise<DocumentRecord>;
  appendUpdate(input: {
    spaceType: SpaceType;
    spaceId: string;
    docId: string;
    clock: number;
    payload: Uint8Array;
    payloadHash: string;
  }): Promise<{ clock: number; duplicate: boolean }>;
  listUpdates(
    spaceType: SpaceType,
    spaceId: string,
    docId: string
  ): Promise<StoredDocUpdate[]>;
  listTimestamps(
    spaceType: SpaceType,
    spaceId: string,
    after?: number
  ): Promise<Record<string, number>>;
  deleteDocument(
    spaceType: SpaceType,
    spaceId: string,
    docId: string
  ): Promise<boolean>;
  deleteSpaceDocuments(spaceType: SpaceType, spaceId: string): Promise<number>;
  setLifecycle(
    spaceType: SpaceType,
    spaceId: string,
    docId: string,
    lifecycle: DocLifecycle,
    timestamp: number
  ): Promise<void>;
  compactDocument(input: {
    spaceType: SpaceType;
    spaceId: string;
    docId: string;
    snapshot: Uint8Array;
    timestamp: number;
  }): Promise<void>;
  saveHistory(record: DocHistoryRecord): Promise<void>;
  listHistories(
    spaceType: SpaceType,
    spaceId: string,
    docId: string,
    opts?: { take?: number; before?: number }
  ): Promise<DocHistoryRecord[]>;
  getHistory(
    spaceType: SpaceType,
    spaceId: string,
    docId: string,
    timestamp: number
  ): Promise<DocHistoryRecord | null>;
  trimHistories(
    spaceType: SpaceType,
    spaceId: string,
    docId: string,
    keep: number
  ): Promise<void>;
}

export interface BlobStore {
  getBlob(workspaceId: string, key: string): Promise<StoredBlob | null>;
  upsertBlob(record: StoredBlob): Promise<StoredBlob>;
  listBlobs(
    workspaceId: string,
    opts?: { includeDeleted?: boolean }
  ): Promise<StoredBlob[]>;
  markBlobDeleted(workspaceId: string, key: string, at: Date): Promise<boolean>;
  deleteBlob(workspaceId: string, key: string): Promise<boolean>;
  deleteWorkspaceBlobs(workspaceId: string): Promise<string[]>;
  usedStorage(workspaceId: string): Promise<number>;
  createUpload(session: BlobUploadSession): Promise<BlobUploadSession>;
  getUpload(uploadId: string): Promise<BlobUploadSession | null>;
  getUploadByToken(token: string): Promise<BlobUploadSession | null>;
  findUpload(
    workspaceId: string,
    key: string
  ): Promise<BlobUploadSession | null>;
  deleteUpload(uploadId: string): Promise<void>;
  putPart(part: BlobUploadPart): Promise<BlobUploadPart>;
  getPartByToken(token: string): Promise<BlobUploadPart | null>;
  listParts(uploadId: string): Promise<BlobUploadPart[]>;
}

export interface BlobObjectStore {
  readonly driver: 'memory' | 'fs' | 's3' | 'gcs';
  put(objectKey: string, bytes: Uint8Array): Promise<void>;
  get(objectKey: string): Promise<Uint8Array | null>;
  delete(objectKey: string): Promise<void>;
  close(): Promise<void>;
}

export interface OauthAccountStore {
  linkOauthAccount(account: OauthAccount): Promise<OauthAccount>;
  findOauthAccount(
    provider: string,
    providerAccountId: string
  ): Promise<OauthAccount | null>;
  listOauthProviders(userId: string): Promise<string[]>;
}

export interface AuditStore {
  appendAudit(event: AuditEvent): Promise<AuditEvent>;
  listAudit(query: AuditQuery): Promise<AuditEvent[]>;
}

export interface SecurityPolicyStore {
  getSecurityPolicy(workspaceId: string | null): Promise<SecurityPolicy | null>;
  upsertSecurityPolicy(policy: SecurityPolicy): Promise<SecurityPolicy>;
}

export interface WebhookStore {
  createWebhook(hook: WorkspaceWebhook): Promise<WorkspaceWebhook>;
  getWebhook(id: string): Promise<WorkspaceWebhook | null>;
  listWebhooks(workspaceId: string): Promise<WorkspaceWebhook[]>;
  deleteWebhook(id: string): Promise<boolean>;
}

export interface AiStore {
  createCopilotSession(
    session: CopilotSessionRecord
  ): Promise<CopilotSessionRecord>;
  getCopilotSession(id: string): Promise<CopilotSessionRecord | null>;
  listCopilotSessions(
    userId: string,
    workspaceId: string
  ): Promise<CopilotSessionRecord[]>;
  countCopilotSessions(userId: string): Promise<number>;
  updateCopilotSession(
    id: string,
    patch: Partial<
      Pick<
        CopilotSessionRecord,
        'docId' | 'pinned' | 'promptName' | 'title' | 'updatedAt'
      >
    >
  ): Promise<CopilotSessionRecord>;
  deleteCopilotSessions(ids: string[]): Promise<string[]>;
  appendCopilotMessage(
    message: CopilotMessageRecord
  ): Promise<CopilotMessageRecord>;
  listCopilotMessages(sessionId: string): Promise<CopilotMessageRecord[]>;
  addCopilotTokenUsage(userId: string, tokens: number): Promise<number>;
  getCopilotTokenUsage(userId: string): Promise<number>;
  createTranscriptTask(
    task: CopilotTranscriptTask
  ): Promise<CopilotTranscriptTask>;
  getTranscriptTask(id: string): Promise<CopilotTranscriptTask | null>;
  findTranscriptTaskByBlob(
    workspaceId: string,
    blobId: string
  ): Promise<CopilotTranscriptTask | null>;
  updateTranscriptTask(
    id: string,
    patch: Partial<
      Pick<
        CopilotTranscriptTask,
        'status' | 'title' | 'summary' | 'transcript' | 'updatedAt'
      >
    >
  ): Promise<CopilotTranscriptTask>;
}

export interface McpStore {
  createMcpCredential(credential: McpCredential): Promise<McpCredential>;
  getMcpCredential(id: string): Promise<McpCredential | null>;
  findMcpCredentialByHash(tokenHash: string): Promise<McpCredential | null>;
  listMcpCredentials(workspaceId: string): Promise<McpCredential[]>;
  updateMcpCredential(
    id: string,
    patch: Partial<
      Pick<
        McpCredential,
        | 'tokenHash'
        | 'fingerprint'
        | 'expiresAt'
        | 'lastUsedAt'
        | 'revokedAt'
        | 'graceEndsAt'
      >
    >
  ): Promise<McpCredential>;
}

export interface CalendarStore {
  createCalendarAccount(account: CalendarAccount): Promise<CalendarAccount>;
  getCalendarAccount(id: string): Promise<CalendarAccount | null>;
  listCalendarAccounts(userId: string): Promise<CalendarAccount[]>;
  updateCalendarAccount(
    id: string,
    patch: Partial<
      Pick<
        CalendarAccount,
        | 'displayName'
        | 'email'
        | 'status'
        | 'lastError'
        | 'refreshIntervalMinutes'
        | 'tokenCipher'
        | 'updatedAt'
      >
    >
  ): Promise<CalendarAccount>;
  deleteCalendarAccount(id: string): Promise<boolean>;
  createCalendarSubscription(
    sub: CalendarSubscription
  ): Promise<CalendarSubscription>;
  listCalendarSubscriptions(
    accountId: string
  ): Promise<CalendarSubscription[]>;
  getCalendarSubscription(id: string): Promise<CalendarSubscription | null>;
  upsertCalendarEvent(event: CalendarEvent): Promise<CalendarEvent>;
  listCalendarEvents(
    subscriptionId: string,
    from: Date,
    to: Date
  ): Promise<CalendarEvent[]>;
  getWorkspaceCalendar(
    workspaceId: string
  ): Promise<WorkspaceCalendar | null>;
  upsertWorkspaceCalendar(
    calendar: WorkspaceCalendar
  ): Promise<WorkspaceCalendar>;
  replaceWorkspaceCalendarItems(
    workspaceCalendarId: string,
    items: WorkspaceCalendarItem[]
  ): Promise<WorkspaceCalendarItem[]>;
  listWorkspaceCalendarItems(
    workspaceCalendarId: string
  ): Promise<WorkspaceCalendarItem[]>;
}

export interface EmbeddingStore {
  replaceEmbeddingChunks(
    workspaceId: string,
    docId: string,
    chunks: EmbeddingChunk[]
  ): Promise<void>;
  listEmbeddingChunks(workspaceId: string): Promise<EmbeddingChunk[]>;
  countEmbeddingChunks(): Promise<number>;
  addIgnoredDocs(docs: EmbeddingIgnoredDoc[]): Promise<number>;
  removeIgnoredDocs(workspaceId: string, docIds: string[]): Promise<number>;
  listIgnoredDocs(workspaceId: string): Promise<EmbeddingIgnoredDoc[]>;
  isIgnoredDoc(workspaceId: string, docId: string): Promise<boolean>;
  createArtifact(artifact: EmbeddingArtifact): Promise<EmbeddingArtifact>;
  getArtifact(artifactId: string): Promise<EmbeddingArtifact | null>;
  listArtifacts(workspaceId: string): Promise<EmbeddingArtifact[]>;
  deleteArtifact(artifactId: string): Promise<boolean>;
  getEmbeddingProgress(workspaceId: string): Promise<EmbeddingProgress>;
  setEmbeddingProgress(progress: EmbeddingProgress): Promise<void>;
}

export interface ByokStore {
  createByokProfile(profile: ByokProfile): Promise<ByokProfile>;
  getByokProfile(profileId: string): Promise<ByokProfile | null>;
  listByokProfiles(workspaceId: string): Promise<ByokProfile[]>;
  updateByokProfile(
    profileId: string,
    patch: Partial<
      Omit<ByokProfile, 'profileId' | 'workspaceId' | 'createdAt'>
    >
  ): Promise<ByokProfile>;
  deleteByokProfile(profileId: string): Promise<boolean>;
  createByokLease(lease: ByokLease): Promise<ByokLease>;
  addByokUsage(
    workspaceId: string,
    date: Date,
    featureKind: string,
    tokens: number
  ): Promise<void>;
  listByokUsage(
    workspaceId: string,
    from: Date,
    to: Date
  ): Promise<ByokUsagePoint[]>;
}

export interface ApiTokenStore {
  createApiToken(token: ApiToken): Promise<ApiToken>;
  getApiToken(id: string): Promise<ApiToken | null>;
  findApiTokenByHash(tokenHash: string): Promise<ApiToken | null>;
  listApiTokens(userId: string): Promise<ApiToken[]>;
  updateApiToken(
    id: string,
    patch: Partial<Pick<ApiToken, 'lastUsedAt' | 'revokedAt'>>
  ): Promise<ApiToken>;
}

export interface InstanceSettingsStore {
  getSetting(key: string): Promise<unknown | null>;
  putSetting(key: string, value: unknown): Promise<void>;
}

export interface NotificationStore {
  createNotification(
    notification: NotificationRecord
  ): Promise<NotificationRecord>;
  getNotification(id: string): Promise<NotificationRecord | null>;
  listNotifications(
    userId: string,
    pagination?: Pagination
  ): Promise<{
    items: NotificationRecord[];
    totalCount: number;
    hasNextPage: boolean;
  }>;
  markNotificationRead(id: string, userId: string, at: Date): Promise<boolean>;
  markAllNotificationsRead(userId: string, at: Date): Promise<number>;
  countUnreadNotifications(userId: string): Promise<number>;
  getNotificationPrefs(userId: string): Promise<NotificationPrefs | null>;
  upsertNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;
}

export interface DnsResolver {
  resolveTxt(domain: string): Promise<string[][]>;
}

export interface OrgStore {
  createOrganization(org: Organization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  getDefaultOrganization(): Promise<Organization | null>;
  updateOrganization(
    id: string,
    patch: Partial<
      Pick<
        Organization,
        | 'name'
        | 'jitEnabled'
        | 'requireMfa'
        | 'ipAllowlist'
        | 'auditRetentionDays'
      >
    >
  ): Promise<Organization>;
  addOrgMember(member: OrgMember): Promise<OrgMember>;
  getOrgMember(orgId: string, userId: string): Promise<OrgMember | null>;
  getOrgMembership(userId: string): Promise<OrgMember | null>;
  listOrgMembers(orgId: string): Promise<OrgMember[]>;
  updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: OrgRole
  ): Promise<void>;
  createOrgDomain(domain: OrgDomain): Promise<OrgDomain>;
  listOrgDomains(orgId: string): Promise<OrgDomain[]>;
  getOrgDomain(id: string): Promise<OrgDomain | null>;
  findOrgDomainByName(orgId: string, domain: string): Promise<OrgDomain | null>;
  findVerifiedDomain(domain: string): Promise<OrgDomain | null>;
  updateOrgDomain(
    id: string,
    patch: Partial<Pick<OrgDomain, 'verifiedAt'>>
  ): Promise<OrgDomain>;
  deleteOrgDomain(id: string): Promise<boolean>;
  upsertOrgIdp(idp: OrganizationIdp): Promise<OrganizationIdp>;
  getOrgIdp(orgId: string): Promise<OrganizationIdp | null>;
}

export interface ScimStore {
  createScimToken(token: ScimToken): Promise<ScimToken>;
  findScimTokenByHash(tokenHash: string): Promise<ScimToken | null>;
  listScimTokens(orgId: string): Promise<ScimToken[]>;
  deleteScimToken(id: string): Promise<boolean>;
  touchScimToken(id: string, at: Date): Promise<void>;
  createScimUser(user: ScimUser): Promise<ScimUser>;
  getScimUser(id: string): Promise<ScimUser | null>;
  findScimUserByExternalId(
    orgId: string,
    externalId: string
  ): Promise<ScimUser | null>;
  findScimUserByUserName(
    orgId: string,
    userName: string
  ): Promise<ScimUser | null>;
  listScimUsers(orgId: string, query: ScimListQuery): Promise<ScimUser[]>;
  countScimUsers(orgId: string, filter?: string | null): Promise<number>;
  updateScimUser(
    id: string,
    patch: Partial<
      Pick<
        ScimUser,
        | 'userId'
        | 'externalId'
        | 'userName'
        | 'displayName'
        | 'active'
        | 'emails'
      >
    >
  ): Promise<ScimUser>;
  deleteScimUser(id: string): Promise<boolean>;
  createScimGroup(group: ScimGroup): Promise<ScimGroup>;
  getScimGroup(id: string): Promise<ScimGroup | null>;
  listScimGroups(orgId: string, query: ScimListQuery): Promise<ScimGroup[]>;
  countScimGroups(orgId: string, filter?: string | null): Promise<number>;
  updateScimGroup(
    id: string,
    patch: Partial<Pick<ScimGroup, 'externalId' | 'displayName' | 'members'>>
  ): Promise<ScimGroup>;
  deleteScimGroup(id: string): Promise<boolean>;
}

export interface MfaStore {
  upsertTotp(record: TotpCredential): Promise<TotpCredential>;
  getTotp(userId: string): Promise<TotpCredential | null>;
  deleteTotp(userId: string): Promise<void>;
  addWebAuthn(record: WebAuthnCredential): Promise<WebAuthnCredential>;
  listWebAuthn(userId: string): Promise<WebAuthnCredential[]>;
  getWebAuthnByCredentialId(
    credentialId: string
  ): Promise<WebAuthnCredential | null>;
  updateWebAuthnCounter(id: string, counter: number): Promise<void>;
  deleteWebAuthn(id: string, userId: string): Promise<boolean>;
  replaceRecoveryCodes(userId: string, codes: RecoveryCode[]): Promise<void>;
  listRecoveryCodes(userId: string): Promise<RecoveryCode[]>;
  consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean>;
  createMfaChallenge(challenge: MfaChallenge): Promise<MfaChallenge>;
  findMfaChallengeByHash(tokenHash: string): Promise<MfaChallenge | null>;
  deleteMfaChallenge(id: string): Promise<void>;
}

export interface MailOutboxStore {
  enqueueOutbox(email: OutboxEmail): Promise<OutboxEmail>;
  getOutbox(id: string): Promise<OutboxEmail | null>;
  listOutbox(from: Date, to: Date): Promise<OutboxEmail[]>;
  listPendingOutbox(limit: number, now: Date): Promise<OutboxEmail[]>;
  updateOutbox(
    id: string,
    patch: Partial<
      Pick<OutboxEmail, 'status' | 'attempts' | 'lastError' | 'sentAt'>
    >
  ): Promise<OutboxEmail>;
}

export interface JobStore {
  enqueueJob(job: JobRecord): Promise<JobRecord>;
  claimDueJobs(
    limit: number,
    now: Date,
    lockUntil: Date,
    workerId: string
  ): Promise<JobRecord[]>;
  completeJob(id: string): Promise<void>;
  failJob(id: string, error: string, retryAt: Date | null): Promise<void>;
}

export interface MailPort {
  readonly configured: boolean;
  send(message: MailMessage): Promise<void>;
}

export interface RedisPort {
  ping(): Promise<boolean>;
  close(): Promise<void>;
  duplicate(): Promise<RedisPort>;
  raw(): unknown;
}

export interface HealthProbe {
  kind: 'memory' | 'postgres';
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface RealtimeHub {
  emit(topic: string, input: Record<string, unknown>, event: unknown): void;
}

export interface MosaicStore
  extends
    IdentityStore,
    WorkspaceStore,
    DocStore,
    BlobStore,
    MembershipStore,
    ShareStore,
    CommentStore,
    OauthAccountStore,
    AuditStore,
    SecurityPolicyStore,
    WebhookStore,
    AiStore,
    McpStore,
    CalendarStore,
    EmbeddingStore,
    ByokStore,
    ApiTokenStore,
    InstanceSettingsStore,
    NotificationStore,
    MailOutboxStore,
    JobStore,
    OrgStore,
    ScimStore,
    MfaStore,
    HealthProbe {}
