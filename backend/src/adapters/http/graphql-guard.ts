import type { FastifyRequest } from 'fastify';

import type { AuthService } from '../../application/auth-service.js';
import type { GdprService } from '../../application/gdpr-service.js';
import type { GuardService } from '../../application/guard-service.js';
import type { User } from '../../domain/identity.js';
import { toGraphQLError } from './graphql-error.js';

export const guardTypeDefs = /* GraphQL */ `
  enum SensitivityLabel {
    Public
    Internal
    Confidential
  }

  type DocSensitivityType {
    workspaceId: String!
    docId: String!
    label: SensitivityLabel!
    updatedAt: DateTime!
    updatedBy: String!
  }

  type RetentionPolicyType {
    workspaceId: String!
    retentionDays: Int
    legalHold: Boolean!
    updatedAt: DateTime!
    updatedBy: String
  }

  input SetWorkspaceRetentionInput {
    workspaceId: String!
    retentionDays: Int
    legalHold: Boolean
  }

  extend type ServerConfigType {
    kmsConfigured: Boolean!
  }

  extend type WorkspaceType {
    retentionPolicy: RetentionPolicyType!
    docSensitivity(docId: String!): SensitivityLabel!
  }

  extend type Mutation {
    setDocSensitivity(
      workspaceId: String!
      docId: String!
      label: SensitivityLabel!
    ): DocSensitivityType!
    setWorkspaceRetention(input: SetWorkspaceRetentionInput!): RetentionPolicyType!
    exportMyData: JSON!
    deleteAccount: DeleteAccount!
  }
`;

export interface GuardGraphqlOpts {
  auth: AuthService;
  guard: GuardService;
  gdpr: GdprService;
  kmsConfigured: boolean;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

export function guardResolvers(opts: GuardGraphqlOpts) {
  const userOf = async (ctx: { request?: FastifyRequest }): Promise<User> =>
    opts.auth.requireUser(opts.requestOf(ctx)?.authSession ?? null);

  return {
    ServerConfigType: {
      kmsConfigured: () => opts.kmsConfigured,
    },
    WorkspaceType: {
      retentionPolicy: async (
        parent: { id: string },
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await userOf(ctx);
          return opts.guard.retentionOf(parent.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      docSensitivity: async (
        parent: { id: string },
        args: { docId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          await userOf(ctx);
          return opts.guard.labelOf(parent.id, args.docId);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    Mutation: {
      setDocSensitivity: async (
        _root: unknown,
        args: { workspaceId: string; docId: string; label: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.guard.setLabel(
            user,
            args.workspaceId,
            args.docId,
            args.label
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      setWorkspaceRetention: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            retentionDays?: number | null;
            legalHold?: boolean | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.guard.setRetention(user, args.input.workspaceId, {
            ...(args.input.retentionDays !== undefined
              ? { retentionDays: args.input.retentionDays }
              : {}),
            ...(args.input.legalHold !== undefined
              ? { legalHold: args.input.legalHold }
              : {}),
          });
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      exportMyData: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.gdpr.export(user);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      deleteAccount: async (
        _root: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return { success: await opts.gdpr.erase(user) };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
