import type { FastifyRequest } from 'fastify';

import type { AuthService } from '../../application/auth-service.js';
import type { MailService } from '../../application/mail-service.js';
import type { NotificationService } from '../../application/notification-service.js';
import type { WorkspaceService } from '../../application/workspace-service.js';
import { errors } from '../../domain/errors.js';
import type { User } from '../../domain/identity.js';
import { toGraphQLError } from './graphql-error.js';

export const notifyTypeDefs = /* GraphQL */ `
  enum NotificationType {
    Comment
    CommentMention
    Invitation
    InvitationAccepted
    InvitationBlocked
    InvitationRejected
    InvitationReviewApproved
    InvitationReviewDeclined
    InvitationReviewRequest
    Mention
  }

  enum NotificationLevel {
    Default
    High
    Low
    Min
    None
  }

  type NotificationObjectType {
    id: ID!
    type: NotificationType!
    level: NotificationLevel!
    read: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    body: JSONObject!
  }

  type NotificationObjectTypeEdge {
    cursor: String!
    node: NotificationObjectType!
  }

  type PaginatedNotificationObjectType {
    totalCount: Int!
    edges: [NotificationObjectTypeEdge!]!
    pageInfo: PageInfo!
  }

  type UserSettingsType {
    receiveInvitationEmail: Boolean!
    receiveMentionEmail: Boolean!
    receiveCommentEmail: Boolean!
  }

  input UpdateUserSettingsInput {
    receiveInvitationEmail: Boolean
    receiveMentionEmail: Boolean
    receiveCommentEmail: Boolean
  }

  input MentionDocInput {
    id: String!
    title: String!
    mode: DocMode!
    blockId: String
    elementId: String
  }

  input MentionInput {
    userId: String!
    workspaceId: String!
    doc: MentionDocInput!
  }

  extend type UserType {
    notifications(pagination: PaginationInput): PaginatedNotificationObjectType!
    settings: UserSettingsType!
  }

  extend type Mutation {
    readNotification(id: String!): Boolean!
    readAllNotifications: Boolean!
    mentionUser(input: MentionInput!): ID!
    updateSettings(input: UpdateUserSettingsInput!): Boolean!
  }
`;

export interface NotifyGraphqlOpts {
  auth: AuthService;
  notifications: NotificationService;
  mail: MailService;
  workspaces: WorkspaceService;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

export function notifyResolvers(opts: NotifyGraphqlOpts) {
  const userOf = async (ctx: { request?: FastifyRequest }): Promise<User> =>
    opts.auth.requireUser(opts.requestOf(ctx)?.authSession ?? null);

  return {
    UserType: {
      notifications: async (
        parent: { id: string },
        args: {
          pagination?: {
            first?: number | null;
            after?: string | null;
            offset?: number | null;
          } | null;
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (user.id !== parent.id) {
            throw errors.accessDenied();
          }
          const page = await opts.notifications.list(user, {
            ...(args.pagination?.first != null
              ? { first: args.pagination.first }
              : {}),
            ...(args.pagination?.after
              ? { after: args.pagination.after }
              : {}),
            ...(args.pagination?.offset != null
              ? { offset: args.pagination.offset }
              : {}),
          });
          return {
            totalCount: page.totalCount,
            edges: page.items.map(item => ({
              cursor: item.cursor,
              node: {
                id: item.id,
                type: item.type,
                level: item.level,
                read: item.read,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                body: item.body,
              },
            })),
            pageInfo: {
              startCursor: page.startCursor,
              endCursor: page.endCursor,
              hasNextPage: page.hasNextPage,
              hasPreviousPage: page.hasPreviousPage,
            },
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      settings: async (
        parent: { id: string },
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (user.id !== parent.id) {
            throw errors.accessDenied();
          }
          return opts.notifications.prefs(user);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    Mutation: {
      readNotification: async (
        _root: unknown,
        args: { id: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return await opts.notifications.read(user, args.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      readAllNotifications: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return await opts.notifications.readAll(user);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      mentionUser: async (
        _root: unknown,
        args: {
          input: {
            userId: string;
            workspaceId: string;
            doc: {
              id: string;
              title: string;
              mode: 'page' | 'edgeless';
              blockId?: string | null;
              elementId?: string | null;
            };
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const id = await opts.notifications.mention(user, {
            userId: args.input.userId,
            workspaceId: args.input.workspaceId,
            doc: {
              id: args.input.doc.id,
              title: args.input.doc.title,
              mode: args.input.doc.mode,
              ...(args.input.doc.blockId
                ? { blockId: args.input.doc.blockId }
                : {}),
              ...(args.input.doc.elementId
                ? { elementId: args.input.doc.elementId }
                : {}),
            },
          });
          const mentioned = await opts.auth.getUserById(args.input.userId);
          const workspace = await opts.workspaces.get(
            user,
            args.input.workspaceId
          );
          if (mentioned) {
            await opts.mail.enqueueMention({
              toEmail: mentioned.email,
              userId: mentioned.id,
              actorName: user.name,
              docTitle: args.input.doc.title,
              workspaceName: workspace.name,
            });
          }
          return id;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateSettings: async (
        _root: unknown,
        args: {
          input: {
            receiveInvitationEmail?: boolean | null;
            receiveMentionEmail?: boolean | null;
            receiveCommentEmail?: boolean | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return await opts.notifications.updatePrefs(user, {
            ...(args.input.receiveInvitationEmail != null
              ? { receiveInvitationEmail: args.input.receiveInvitationEmail }
              : {}),
            ...(args.input.receiveMentionEmail != null
              ? { receiveMentionEmail: args.input.receiveMentionEmail }
              : {}),
            ...(args.input.receiveCommentEmail != null
              ? { receiveCommentEmail: args.input.receiveCommentEmail }
              : {}),
          });
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
