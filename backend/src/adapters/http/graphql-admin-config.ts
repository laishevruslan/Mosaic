import type { FastifyRequest } from 'fastify';

import type { AppConfigService } from '../../application/app-config-service.js';
import type { AuthService } from '../../application/auth-service.js';
import type { MailService } from '../../application/mail-service.js';
import { errors } from '../../domain/errors.js';
import type { User } from '../../domain/identity.js';
import { toGraphQLError } from './graphql-error.js';

export const adminConfigTypeDefs = /* GraphQL */ `
  input UpdateAppConfigInput {
    module: String!
    key: String!
    value: JSON
  }

  type AppConfigValidateResult {
    module: String!
    key: String!
    value: JSON
    valid: Boolean!
    error: String
  }

  input TestEmailConfigInput {
    name: String!
    host: String!
    port: Int!
    sender: String!
    username: String!
    password: String!
    ignoreTLS: Boolean!
  }

  extend type Query {
    validateAppConfig(
      updates: [UpdateAppConfigInput!]!
    ): [AppConfigValidateResult!]!
  }

  extend type Mutation {
    updateAppConfig(updates: [UpdateAppConfigInput!]!): JSON
    sendTestEmail(config: TestEmailConfigInput!): Boolean!
  }
`;

export interface AdminConfigGraphqlOpts {
  auth: AuthService;
  appConfig: AppConfigService;
  mail: MailService;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

export function adminConfigResolvers(opts: AdminConfigGraphqlOpts) {
  const userOf = async (ctx: { request?: FastifyRequest }): Promise<User> =>
    opts.auth.requireUser(opts.requestOf(ctx)?.authSession ?? null);

  return {
    Query: {
      validateAppConfig: async (
        _root: unknown,
        args: {
          updates: Array<{ module: string; key: string; value: unknown }>;
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.appConfig.validate(user, args.updates);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    Mutation: {
      updateAppConfig: async (
        _root: unknown,
        args: {
          updates: Array<{ module: string; key: string; value: unknown }>;
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return await opts.appConfig.update(user, args.updates);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      sendTestEmail: async (
        _root: unknown,
        args: {
          config: {
            name: string;
            host: string;
            port: number;
            sender: string;
            username: string;
            password: string;
            ignoreTLS: boolean;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          opts.auth.requireInstanceAdmin(user);
          if (!opts.mail.configured) {
            throw errors.emailServiceNotConfigured();
          }
          await opts.mail.sendTest({
            to: args.config.sender,
            subject: `Mosaic test email (${args.config.name})`,
            text: 'Mosaic SMTP test message.',
            html: '<p>Mosaic SMTP test message.</p>',
          });
          return true;
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
