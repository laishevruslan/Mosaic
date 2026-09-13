import type { FastifyRequest } from 'fastify';

import type { AnalyticsService } from '../../application/analytics-service.js';
import type { AdminUserService } from '../../application/admin-user-service.js';
import type { AuditService } from '../../application/audit-service.js';
import type { AuthService } from '../../application/auth-service.js';
import type { MailService } from '../../application/mail-service.js';
import type { MembershipService } from '../../application/membership-service.js';
import type { OrgService } from '../../application/org-service.js';
import type { ScimService } from '../../application/scim-service.js';
import type { SecurityPolicyService } from '../../application/security-policy-service.js';
import type { ShareService } from '../../application/share-service.js';
import type { SigningKeyService } from '../../application/signing-key-service.js';
import type { WorkspaceService } from '../../application/workspace-service.js';
import type { User, UserFeature, Workspace } from '../../domain/identity.js';
import type { OutboxEmail } from '../../domain/notify.js';
import type { MosaicStore } from '../../domain/ports.js';
import { toGraphQLError } from './graphql-error.js';

export const adminTypeDefs = /* GraphQL */ `
  enum TimeBucket {
    Day
    Hour
    Minute
  }

  enum AdminWorkspaceSort {
    CreatedAt
    MemberCount
    PublicPageCount
    SnapshotCount
    SnapshotSize
    BlobCount
    BlobSize
  }

  enum AdminSharedLinksOrder {
    PublishedAtDesc
    UpdatedAtDesc
    ViewsDesc
  }

  enum AdminWorkspaceMemberRole {
    Owner
    Admin
    Collaborator
  }

  input ListUserInput {
    first: Int = 20
    skip: Int = 0
    keyword: String
    features: [FeatureType!]
  }

  input CreateUserInput {
    email: String!
    name: String
    password: String
  }

  input ImportUsersInput {
    users: [CreateUserInput!]!
  }

  input ManageUserInput {
    email: String
    name: String
  }

  input ListWorkspaceInput {
    first: Int! = 20
    skip: Int! = 0
    keyword: String
    public: Boolean
    enableAi: Boolean
    enableSharing: Boolean
    enableUrlPreview: Boolean
    enableDocEmbedding: Boolean
    orderBy: AdminWorkspaceSort
  }

  input AdminUpdateWorkspaceInput {
    id: String!
    name: String
    public: Boolean
    avatarKey: String
    enableAi: Boolean
    enableSharing: Boolean
    enableUrlPreview: Boolean
    enableDocEmbedding: Boolean
  }

  input AdminAllSharedLinksFilterInput {
    keyword: String
    workspaceId: String
    orderBy: AdminSharedLinksOrder = UpdatedAtDesc
    analyticsWindowDays: Int = 28
    includeTotal: Boolean = false
  }

  input AdminMailDeliveriesInput {
    hours: Int! = 24
  }

  type UserImportFailedType {
    email: String!
    error: String!
  }

  union UserImportResultType = UserImportFailedType | UserType

  type DeleteAccount {
    success: Boolean!
  }

  type ReleaseVersionType {
    changelog: String!
    version: String!
    publishedAt: DateTime!
    url: String!
  }

  type TimeWindow {
    from: DateTime!
    to: DateTime!
    timezone: String!
    bucket: TimeBucket!
    requestedSize: Int!
    effectiveSize: Int!
  }

  input AdminDashboardInput {
    copilotWindowDays: Int
    sharedLinkWindowDays: Int
    storageHistoryDays: Int
    syncHistoryHours: Int
    timezone: String
  }

  type AdminDashboardMinutePoint {
    minute: DateTime!
    activeUsers: Int!
  }

  type AdminDashboardValueDayPoint {
    date: DateTime!
    value: SafeInt!
  }

  type AdminSharedLinkTopItem {
    workspaceId: String!
    docId: String!
    title: String
    shareUrl: String!
    publishedAt: DateTime
    views: SafeInt!
    uniqueViews: SafeInt!
    guestViews: SafeInt!
    lastAccessedAt: DateTime
  }

  type AdminDashboard {
    syncActiveUsers: Int!
    syncActiveUsersTimeline: [AdminDashboardMinutePoint!]!
    syncWindow: TimeWindow!
    copilotConversations: Int!
    copilotWindow: TimeWindow!
    workspaceStorageBytes: SafeInt!
    blobStorageBytes: SafeInt!
    workspaceStorageHistory: [AdminDashboardValueDayPoint!]!
    blobStorageHistory: [AdminDashboardValueDayPoint!]!
    storageWindow: TimeWindow!
    topSharedLinks: [AdminSharedLinkTopItem!]!
    topSharedLinksWindow: TimeWindow!
    generatedAt: DateTime!
  }

  type WorkspaceUserTypeAdmin {
    id: String!
    name: String!
    email: String!
    avatarUrl: String
  }

  type AdminWorkspaceMember {
    id: String!
    name: String!
    email: String!
    avatarUrl: String
    role: AdminWorkspaceMemberRole!
    status: WorkspaceMemberStatus!
  }

  type AdminWorkspaceSharedLink {
    docId: String!
    title: String
    publishedAt: DateTime
  }

  type AdminWorkspace {
    id: String!
    public: Boolean!
    createdAt: DateTime!
    name: String
    avatarKey: String
    enableAi: Boolean!
    enableSharing: Boolean!
    enableUrlPreview: Boolean!
    enableDocEmbedding: Boolean!
    owner: WorkspaceUserType
    memberCount: Int!
    publicPageCount: Int!
    snapshotCount: Int!
    snapshotSize: SafeInt!
    blobCount: Int!
    blobSize: SafeInt!
    sharedLinks: [AdminWorkspaceSharedLink!]!
    members(skip: Int, take: Int, query: String): [AdminWorkspaceMember!]!
  }

  type AdminAllSharedLink {
    workspaceId: String!
    docId: String!
    title: String
    publishedAt: DateTime
    docUpdatedAt: DateTime
    workspaceOwnerId: String
    lastUpdaterId: String
    shareUrl: String!
    views: SafeInt
    uniqueViews: SafeInt
    guestViews: SafeInt
    lastAccessedAt: DateTime
  }

  type AdminAllSharedLinkEdge {
    cursor: String!
    node: AdminAllSharedLink!
  }

  type PaginatedAdminAllSharedLink {
    totalCount: Int
    analyticsWindow: TimeWindow!
    pageInfo: PageInfo!
    edges: [AdminAllSharedLinkEdge!]!
  }

  type AdminMailDeliveryPoint {
    bucket: DateTime!
    count: Int!
  }

  type AdminMailDeliverySeries {
    key: String!
    label: String!
    total: Int!
    points: [AdminMailDeliveryPoint!]!
  }

  type AdminMailDeliverySummary {
    total: Int!
    sent: Int!
    failed: Int!
    skipped: Int!
    canceled: Int!
    queued: Int!
    sending: Int!
    retryWait: Int!
    successRate: Float!
  }

  type AdminMailDeliveryAnalytics {
    window: TimeWindow!
    summary: AdminMailDeliverySummary!
    byStatus: [AdminMailDeliverySeries!]!
    byType: [AdminMailDeliverySeries!]!
    byOutcome: [AdminMailDeliverySeries!]!
  }

  type AuthSigningKeyType {
    id: String!
    status: String!
    source: String!
    createdAt: DateTime
    retiredAt: DateTime
    verifyUntil: DateTime
    canDelete: Boolean!
  }

  type OrganizationType {
    id: ID!
    name: String!
    slug: String!
    jitEnabled: Boolean!
    requireMfa: String!
    ipAllowlist: [String!]!
    auditRetentionDays: Int
  }

  type OrgDomainType {
    id: ID!
    domain: String!
    token: String!
    verifiedAt: DateTime
    txtRecord: String!
  }

  type ScimTokenType {
    id: ID!
    name: String!
    createdAt: DateTime!
    lastUsedAt: DateTime
    token: String
  }

  type OrganizationIdpType {
    id: ID!
    kind: String!
    enabled: Boolean!
    issuer: String
    clientId: String
    configured: Boolean!
    ssoUrl: String
    entityId: String
    groupClaim: String
  }

  input OrganizationIdpInput {
    kind: String!
    enabled: Boolean
    issuer: String
    clientId: String
    clientSecret: String
    ssoUrl: String
    entityId: String
    certificate: String
    groupClaim: String
  }

  input OrganizationUpdateInput {
    name: String
    jitEnabled: Boolean
    requireMfa: String
    ipAllowlist: [String!]
    auditRetentionDays: Int
  }

  extend type ServerConfigType {
    availableUserFeatures: [FeatureType!]!
    availableUpgrade: ReleaseVersionType
  }

  extend type Query {
    users(filter: ListUserInput!): [UserType!]!
    usersCount(filter: ListUserInput): Int!
    userByEmail(email: String!): UserType
    adminWorkspaces(filter: ListWorkspaceInput!): [AdminWorkspace!]!
    adminWorkspacesCount(filter: ListWorkspaceInput!): Int!
    adminWorkspace(id: String!): AdminWorkspace
    adminAllSharedLinks(
      pagination: PaginationInput!
      filter: AdminAllSharedLinksFilterInput
    ): PaginatedAdminAllSharedLink!
    adminMailDeliveries(input: AdminMailDeliveriesInput): AdminMailDeliveryAnalytics!
    adminDashboard(input: AdminDashboardInput): AdminDashboard!
    authSigningKeys: [AuthSigningKeyType!]!
    organization: OrganizationType
    organizationDomains: [OrgDomainType!]!
    organizationIdp: OrganizationIdpType
    scimTokens: [ScimTokenType!]!
  }

  extend type Mutation {
    createUser(input: CreateUserInput!): UserType!
    importUsers(input: ImportUsersInput!): [UserImportResultType!]!
    updateUser(id: String!, input: ManageUserInput!): UserType!
    updateUserFeatures(id: String!, features: [FeatureType!]!): [FeatureType!]!
    banUser(id: String!): UserType!
    enableUser(id: String!): UserType!
    deleteUser(id: String!): DeleteAccount!
    createChangePasswordUrl(callbackUrl: String!, userId: String!): String!
    adminUpdateWorkspace(input: AdminUpdateWorkspaceInput!): AdminWorkspace
    rotateAuthSigningKey(expectedActiveKeyId: String!): [AuthSigningKeyType!]!
    deleteAuthSigningKey(id: String!): [AuthSigningKeyType!]!
    updateOrganization(input: OrganizationUpdateInput!): OrganizationType!
    addOrganizationDomain(domain: String!): OrgDomainType!
    verifyOrganizationDomain(id: String!): OrgDomainType!
    deleteOrganizationDomain(id: String!): Boolean!
    upsertOrganizationIdp(input: OrganizationIdpInput!): OrganizationIdpType!
    createScimToken(name: String!): ScimTokenType!
    revokeScimToken(id: String!): Boolean!
  }
`;

function timeWindow(hours: number, bucket: 'Hour' | 'Day' | 'Minute' = 'Hour') {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return {
    from,
    to,
    timezone: 'UTC',
    bucket,
    requestedSize: hours,
    effectiveSize: hours,
  };
}

export interface AdminGraphqlOpts {
  auth: AuthService;
  users: AdminUserService;
  workspaces: WorkspaceService;
  members: MembershipService;
  shares: ShareService;
  store: MosaicStore;
  mail: MailService;
  signingKeys: SigningKeyService;
  orgs: OrgService;
  scim: ScimService;
  policy: SecurityPolicyService;
  audit: AuditService;
  analytics: AnalyticsService;
  publicUrl: string;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

export function adminResolvers(opts: AdminGraphqlOpts) {
  const adminOf = async (ctx: { request?: FastifyRequest }): Promise<User> => {
    const user = await opts.auth.requireUser(
      opts.requestOf(ctx)?.authSession ?? null
    );
    opts.auth.requireInstanceAdmin(user);
    return user;
  };

  const gqlListedUser = async (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    features: user.features,
    disabled: user.disabled,
    hasPassword: await opts.users.hasPassword(user),
  });

  const toAdminWorkspace = async (workspace: Workspace) => {
    const [owner, memberCount, publicDocs, blobs] = await Promise.all([
      opts.workspaces.ownerOf(workspace.id),
      opts.store.countMembers(workspace.id),
      opts.store.listPublicDocs(workspace.id),
      opts.store.listBlobs(workspace.id),
    ]);
    const timestamps = await opts.store.listTimestamps('workspace', workspace.id);
    const blobSize = blobs.reduce((sum, blob) => sum + blob.size, 0);
    return {
      id: workspace.id,
      public: workspace.isPublic,
      createdAt: workspace.createdAt,
      name: workspace.name,
      avatarKey: workspace.avatarKey,
      enableAi: workspace.enableAi,
      enableSharing: workspace.enableSharing,
      enableUrlPreview: workspace.enableUrlPreview,
      enableDocEmbedding: workspace.enableDocEmbedding,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            avatarUrl: owner.avatarUrl,
          }
        : null,
      memberCount,
      publicPageCount: publicDocs.length,
      snapshotCount: Object.keys(timestamps).length,
      snapshotSize: 0,
      blobCount: blobs.length,
      blobSize,
      _workspaceId: workspace.id,
    };
  };

  const mailAnalytics = async (hours: number) => {
    const window = timeWindow(hours);
    const rows = await opts.store.listOutbox(window.from, window.to);
    const countBy = (key: (row: OutboxEmail) => string) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const id = key(row);
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      return [...map.entries()].map(([id, total]) => ({
        key: id,
        label: id,
        total,
        points: [{ bucket: window.to, count: total }],
      }));
    };
    const sent = rows.filter(row => row.status === 'sent').length;
    const failed = rows.filter(row => row.status === 'failed').length;
    const skipped = rows.filter(row => row.status === 'skipped').length;
    const queued = rows.filter(row => row.status === 'pending').length;
    return {
      window,
      summary: {
        total: rows.length,
        sent,
        failed,
        skipped,
        canceled: 0,
        queued,
        sending: 0,
        retryWait: 0,
        successRate: rows.length === 0 ? 1 : sent / rows.length,
      },
      byStatus: countBy(row => row.status),
      byType: countBy(row => row.template),
      byOutcome: countBy(row =>
        row.status === 'sent' ? 'success' : row.status
      ),
    };
  };

  return {
    UserImportResultType: {
      __resolveType(obj: { error?: string }) {
        return obj.error ? 'UserImportFailedType' : 'UserType';
      },
    },
    UserType: {
      disabled: (parent: { disabled?: boolean }) => Boolean(parent.disabled),
    },
    ServerConfigType: {
      availableUserFeatures: () => ['Admin'],
      availableUpgrade: () => null,
    },
    AdminWorkspace: {
      sharedLinks: async (parent: { id: string }) => {
        const docs = await opts.store.listPublicDocs(parent.id);
        return docs.map(doc => ({
          docId: doc.docId,
          title: null,
          publishedAt: doc.publishedAt,
        }));
      },
      members: async (
        parent: { id: string },
        args: { skip?: number | null; take?: number | null; query?: string | null }
      ) => {
        const listed = await opts.store.listMembers(parent.id);
        const skip = Math.max(0, args.skip ?? 0);
        const take = Math.min(100, Math.max(1, args.take ?? 50));
        const query = args.query?.trim().toLowerCase();
        const users = await Promise.all(
          listed.map(async member => {
            const user = await opts.auth.getUserById(member.userId);
            return { member, user };
          })
        );
        return users
          .filter(item => item.user)
          .filter(item => {
            if (!query) {
              return true;
            }
            return (
              item.user!.email.toLowerCase().includes(query) ||
              item.user!.name.toLowerCase().includes(query)
            );
          })
          .slice(skip, skip + take)
          .map(item => ({
            id: item.user!.id,
            name: item.user!.name,
            email: item.user!.email,
            avatarUrl: item.user!.avatarUrl,
            role:
              item.member.role === 'owner'
                ? 'Owner'
                : item.member.role === 'admin'
                  ? 'Admin'
                  : 'Collaborator',
            status: 'Accepted',
          }));
      },
    },
    Query: {
      users: async (
        _root: unknown,
        args: {
          filter: {
            first?: number | null;
            skip?: number | null;
            keyword?: string | null;
            features?: UserFeature[] | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          const listed = await opts.users.list({
            skip: args.filter.skip ?? 0,
            take: args.filter.first ?? 20,
            ...(args.filter.keyword ? { keyword: args.filter.keyword } : {}),
            ...(args.filter.features
              ? { features: args.filter.features }
              : {}),
          });
          return Promise.all(listed.users.map(gqlListedUser));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      usersCount: async (
        _root: unknown,
        args: {
          filter?: {
            keyword?: string | null;
            features?: UserFeature[] | null;
          } | null;
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          const listed = await opts.users.list({
            skip: 0,
            take: 1,
            ...(args.filter?.keyword ? { keyword: args.filter.keyword } : {}),
            ...(args.filter?.features
              ? { features: args.filter.features }
              : {}),
          });
          return listed.count;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      userByEmail: async (
        _root: unknown,
        args: { email: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          const user = await opts.users.getByEmail(args.email);
          return user ? gqlListedUser(user) : null;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminWorkspaces: async (
        _root: unknown,
        args: {
          filter: {
            first?: number;
            skip?: number;
            keyword?: string | null;
            public?: boolean | null;
            enableAi?: boolean | null;
            enableSharing?: boolean | null;
            enableUrlPreview?: boolean | null;
            enableDocEmbedding?: boolean | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          const workspaces = await opts.store.listAllWorkspaces({
            skip: args.filter.skip ?? 0,
            take: args.filter.first ?? 20,
            ...(args.filter.keyword ? { keyword: args.filter.keyword } : {}),
            ...(args.filter.public != null ? { isPublic: args.filter.public } : {}),
            ...(args.filter.enableAi != null
              ? { enableAi: args.filter.enableAi }
              : {}),
            ...(args.filter.enableSharing != null
              ? { enableSharing: args.filter.enableSharing }
              : {}),
            ...(args.filter.enableUrlPreview != null
              ? { enableUrlPreview: args.filter.enableUrlPreview }
              : {}),
            ...(args.filter.enableDocEmbedding != null
              ? { enableDocEmbedding: args.filter.enableDocEmbedding }
              : {}),
          });
          return Promise.all(workspaces.map(toAdminWorkspace));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminWorkspacesCount: async (
        _root: unknown,
        args: { filter: { keyword?: string | null } },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return opts.store.countAllWorkspaces({
            ...(args.filter.keyword ? { keyword: args.filter.keyword } : {}),
          });
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminWorkspace: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          const workspace = await opts.store.getWorkspace(args.id);
          if (!workspace) {
            return null;
          }
          return toAdminWorkspace(workspace);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminAllSharedLinks: async (
        _root: unknown,
        args: {
          pagination: { first?: number | null; offset?: number | null };
          filter?: { keyword?: string | null; workspaceId?: string | null } | null;
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          let docs = await opts.store.listAllPublicDocs();
          if (args.filter?.workspaceId) {
            docs = docs.filter(doc => doc.workspaceId === args.filter?.workspaceId);
          }
          const offset = Math.max(0, args.pagination.offset ?? 0);
          const first = Math.min(50, Math.max(1, args.pagination.first ?? 10));
          const slice = docs.slice(offset, offset + first);
          const window = timeWindow(24 * 28, 'Day');
          return {
            totalCount: docs.length,
            analyticsWindow: window,
            pageInfo: {
              hasNextPage: offset + slice.length < docs.length,
              hasPreviousPage: offset > 0,
              startCursor: slice[0] ? `${slice[0].workspaceId}:${slice[0].docId}` : null,
              endCursor: slice.at(-1)
                ? `${slice.at(-1)!.workspaceId}:${slice.at(-1)!.docId}`
                : null,
            },
            edges: slice.map(doc => ({
              cursor: `${doc.workspaceId}:${doc.docId}`,
              node: {
                workspaceId: doc.workspaceId,
                docId: doc.docId,
                title: null,
                publishedAt: doc.publishedAt,
                docUpdatedAt: doc.publishedAt,
                workspaceOwnerId: null,
                lastUpdaterId: doc.publishedBy,
                shareUrl: `${opts.publicUrl}/workspace/${doc.workspaceId}/${doc.docId}`,
                views: 0,
                uniqueViews: 0,
                guestViews: 0,
                lastAccessedAt: null,
              },
            })),
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminMailDeliveries: async (
        _root: unknown,
        args: { input?: { hours?: number } | null },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return mailAnalytics(args.input?.hours ?? 24);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminDashboard: async (
        _root: unknown,
        args: {
          input?: {
            copilotWindowDays?: number | null;
            sharedLinkWindowDays?: number | null;
            storageHistoryDays?: number | null;
            syncHistoryHours?: number | null;
            timezone?: string | null;
          } | null;
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return opts.analytics.dashboard(args.input ?? {});
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      authSigningKeys: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return opts.signingKeys.list();
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      organization: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          return opts.orgs.requireOrgAdmin(user);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      organizationDomains: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const domains = await opts.orgs.listDomains(user);
          return domains.map(domain => ({
            ...domain,
            txtRecord: `mosaic-domain-verification=${domain.token}`,
          }));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      organizationIdp: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const org = await opts.orgs.requireOrgAdmin(user);
          const idp = await opts.orgs.getIdp(org.id);
          if (!idp) {
            return null;
          }
          return {
            id: idp.id,
            kind: idp.kind,
            enabled: idp.enabled,
            issuer: idp.issuer,
            clientId: idp.clientId,
            configured: Boolean(idp.clientSecret || idp.certificate),
            ssoUrl: idp.ssoUrl,
            entityId: idp.entityId,
            groupClaim: idp.groupClaim,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      scimTokens: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          return opts.scim.listTokens(user);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    Mutation: {
      createUser: async (
        _root: unknown,
        args: { input: { email: string; name?: string | null; password?: string | null } },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return gqlListedUser(await opts.users.create(args.input));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      importUsers: async (
        _root: unknown,
        args: {
          input: {
            users: Array<{ email: string; name?: string | null; password?: string | null }>;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          const imported = await opts.users.importUsers(args.input.users);
          return Promise.all(
            imported.map(async item =>
              'error' in item ? item : gqlListedUser(item)
            )
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateUser: async (
        _root: unknown,
        args: { id: string; input: { name?: string | null; email?: string | null } },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return gqlListedUser(await opts.users.update(args.id, args.input));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateUserFeatures: async (
        _root: unknown,
        args: { id: string; features: UserFeature[] },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return opts.users.updateFeatures(args.id, args.features);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      banUser: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const actor = await adminOf(ctx);
          return gqlListedUser(await opts.users.setDisabled(actor, args.id, true));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      enableUser: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const actor = await adminOf(ctx);
          return gqlListedUser(
            await opts.users.setDisabled(actor, args.id, false)
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      deleteUser: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const actor = await adminOf(ctx);
          return { success: await opts.users.delete(actor, args.id) };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      createChangePasswordUrl: async (
        _root: unknown,
        args: { callbackUrl: string; userId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return opts.users.changePasswordUrl(args.userId, args.callbackUrl);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      adminUpdateWorkspace: async (
        _root: unknown,
        args: {
          input: {
            id: string;
            name?: string | null;
            public?: boolean | null;
            avatarKey?: string | null;
            enableAi?: boolean | null;
            enableSharing?: boolean | null;
            enableUrlPreview?: boolean | null;
            enableDocEmbedding?: boolean | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const actor = await adminOf(ctx);
          void actor;
          const existing = await opts.store.getWorkspace(args.input.id);
          if (!existing) {
            return null;
          }
          const workspace = await opts.store.updateWorkspace(args.input.id, {
            ...(args.input.name != null ? { name: args.input.name } : {}),
            ...(args.input.public != null ? { isPublic: args.input.public } : {}),
            ...(args.input.avatarKey !== undefined
              ? { avatarKey: args.input.avatarKey }
              : {}),
            ...(args.input.enableAi != null ? { enableAi: args.input.enableAi } : {}),
            ...(args.input.enableSharing != null
              ? { enableSharing: args.input.enableSharing }
              : {}),
            ...(args.input.enableUrlPreview != null
              ? { enableUrlPreview: args.input.enableUrlPreview }
              : {}),
            ...(args.input.enableDocEmbedding != null
              ? { enableDocEmbedding: args.input.enableDocEmbedding }
              : {}),
          });
          return toAdminWorkspace(workspace);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      rotateAuthSigningKey: async (
        _root: unknown,
        args: { expectedActiveKeyId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const actor = await adminOf(ctx);
          return opts.signingKeys.rotate(args.expectedActiveKeyId, actor);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      deleteAuthSigningKey: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await adminOf(ctx);
          return opts.signingKeys.delete(args.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateOrganization: async (
        _root: unknown,
        args: {
          input: {
            name?: string | null;
            jitEnabled?: boolean | null;
            requireMfa?: string | null;
            ipAllowlist?: string[] | null;
            auditRetentionDays?: number | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const org = await opts.orgs.update(user, {
            ...(args.input.name != null ? { name: args.input.name } : {}),
            ...(args.input.jitEnabled != null
              ? { jitEnabled: args.input.jitEnabled }
              : {}),
            ...(args.input.requireMfa
              ? { requireMfa: args.input.requireMfa as 'off' | 'all' | 'if_not_sso' }
              : {}),
            ...(args.input.ipAllowlist
              ? { ipAllowlist: args.input.ipAllowlist }
              : {}),
            ...(args.input.auditRetentionDays !== undefined
              ? { auditRetentionDays: args.input.auditRetentionDays }
              : {}),
          });
          if (args.input.ipAllowlist) {
            await opts.policy.update(null, {
              ipAllowlist: args.input.ipAllowlist,
            });
          }
          return org;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      addOrganizationDomain: async (
        _root: unknown,
        args: { domain: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const domain = await opts.orgs.addDomain(user, args.domain);
          return {
            ...domain,
            txtRecord: `mosaic-domain-verification=${domain.token}`,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      verifyOrganizationDomain: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const domain = await opts.orgs.verifyDomain(user, args.id);
          return {
            ...domain,
            txtRecord: `mosaic-domain-verification=${domain.token}`,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      deleteOrganizationDomain: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          return opts.orgs.deleteDomain(user, args.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      upsertOrganizationIdp: async (
        _root: unknown,
        args: {
          input: {
            kind: string;
            enabled?: boolean | null;
            issuer?: string | null;
            clientId?: string | null;
            clientSecret?: string | null;
            ssoUrl?: string | null;
            entityId?: string | null;
            certificate?: string | null;
            groupClaim?: string | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const idp = await opts.orgs.upsertIdp(user, {
            kind: args.input.kind === 'saml' ? 'saml' : 'oidc',
            ...(args.input.enabled != null ? { enabled: args.input.enabled } : {}),
            ...(args.input.issuer != null ? { issuer: args.input.issuer } : {}),
            ...(args.input.clientId != null ? { clientId: args.input.clientId } : {}),
            ...(args.input.clientSecret != null
              ? { clientSecret: args.input.clientSecret }
              : {}),
            ...(args.input.ssoUrl != null ? { ssoUrl: args.input.ssoUrl } : {}),
            ...(args.input.entityId != null ? { entityId: args.input.entityId } : {}),
            ...(args.input.certificate != null
              ? { certificate: args.input.certificate }
              : {}),
            ...(args.input.groupClaim != null
              ? { groupClaim: args.input.groupClaim }
              : {}),
          });
          return {
            id: idp.id,
            kind: idp.kind,
            enabled: idp.enabled,
            issuer: idp.issuer,
            clientId: idp.clientId,
            configured: Boolean(idp.clientSecret || idp.certificate),
            ssoUrl: idp.ssoUrl,
            entityId: idp.entityId,
            groupClaim: idp.groupClaim,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      createScimToken: async (
        _root: unknown,
        args: { name: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          const created = await opts.scim.createToken(user, args.name);
          return {
            id: created.id,
            name: args.name,
            createdAt: new Date(),
            lastUsedAt: null,
            token: created.token,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      revokeScimToken: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await adminOf(ctx);
          return opts.scim.revokeToken(user, args.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
