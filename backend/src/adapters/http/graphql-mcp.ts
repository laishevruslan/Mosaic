import type { FastifyRequest } from 'fastify';

import type { AuthService } from '../../application/auth-service.js';
import { mcpStatus, type McpService } from '../../application/mcp-service.js';
import type { User } from '../../domain/identity.js';
import type { McpCredential } from '../../domain/mcp.js';
import { toGraphQLError } from './graphql-error.js';

export const mcpTypeDefs = /* GraphQL */ `
  enum McpAccessMode {
    READ_ONLY
    READ_WRITE
  }

  enum McpCredentialStatus {
    ACTIVE
    EXPIRED
    EXPIRING
    REVOKED
    ROTATING
  }

  type McpCredentialType {
    id: ID!
    name: String!
    workspaceId: String!
    accessMode: McpAccessMode!
    fingerprint: String!
    createdAt: DateTime!
    expiresAt: DateTime!
    lastUsedAt: DateTime
    revokedAt: DateTime
    graceEndsAt: DateTime
    status: McpCredentialStatus!
  }

  type CreateMcpCredentialPayload {
    credential: McpCredentialType!
    token: String!
  }

  input CreateMcpCredentialInput {
    accessMode: McpAccessMode
    expirationDays: Int
    name: String!
    workspaceId: String!
  }

  extend type Query {
    mcpCredentialReadWriteAvailable: Boolean!
    mcpCredentials(workspaceId: String!): [McpCredentialType!]!
  }

  extend type Mutation {
    createMcpCredential(input: CreateMcpCredentialInput!): CreateMcpCredentialPayload!
    revokeMcpCredential(id: ID!, workspaceId: String!): Boolean!
    rotateMcpCredential(
      id: ID!
      workspaceId: String!
      expirationDays: Int!
    ): CreateMcpCredentialPayload!
  }
`;

export interface McpGraphqlOpts {
  auth: AuthService;
  mcp: McpService;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

function gqlCredential(credential: McpCredential, now: Date) {
  return {
    ...credential,
    status: mcpStatus(credential, now),
  };
}

export function mcpResolvers(opts: McpGraphqlOpts) {
  const userOf = async (ctx: { request?: FastifyRequest }): Promise<User> =>
    opts.auth.requireUser(opts.requestOf(ctx)?.authSession ?? null);

  return {
    Query: {
      mcpCredentialReadWriteAvailable: () => opts.mcp.readWriteAvailable(),
      mcpCredentials: async (
        _root: unknown,
        args: { workspaceId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const now = new Date();
          const list = await opts.mcp.list(user, args.workspaceId);
          return list.map(item => gqlCredential(item, now));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    Mutation: {
      createMcpCredential: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            name: string;
            accessMode?: 'READ_ONLY' | 'READ_WRITE' | null;
            expirationDays?: number | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const created = await opts.mcp.create(user, args.input);
          return {
            credential: gqlCredential(created.credential, new Date()),
            token: created.token,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      revokeMcpCredential: async (
        _root: unknown,
        args: { id: string; workspaceId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.mcp.revoke(user, args.workspaceId, args.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      rotateMcpCredential: async (
        _root: unknown,
        args: { id: string; workspaceId: string; expirationDays: number },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const rotated = await opts.mcp.rotate(
            user,
            args.workspaceId,
            args.id,
            args.expirationDays
          );
          return {
            credential: gqlCredential(rotated.credential, new Date()),
            token: rotated.token,
          };
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
