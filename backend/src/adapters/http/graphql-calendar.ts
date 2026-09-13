import type { FastifyRequest } from 'fastify';

import type { AuthService } from '../../application/auth-service.js';
import type { CalendarService } from '../../application/calendar-service.js';
import { errors } from '../../domain/errors.js';
import type { User } from '../../domain/identity.js';
import { toGraphQLError } from './graphql-error.js';

export const calendarTypeDefs = /* GraphQL */ `
  type CalendarCalDAVProviderPresetObjectType {
    id: String!
    label: String!
    requiresAppPassword: Boolean
    docsUrl: String
  }

  type CalendarSubscriptionObjectType {
    id: String!
    accountId: String!
    provider: CalendarProviderType!
    externalCalendarId: String!
    displayName: String
    timezone: String
    color: String
    enabled: Boolean!
    lastSyncAt: DateTime
  }

  type CalendarAccountObjectType {
    id: String!
    provider: CalendarProviderType!
    providerAccountId: String!
    displayName: String
    email: String
    status: String!
    lastError: String
    refreshIntervalMinutes: Int!
    calendarsCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    calendars: [CalendarSubscriptionObjectType!]!
  }

  type CalendarEventObjectType {
    id: String!
    subscriptionId: String!
    externalEventId: String!
    recurrenceId: String
    status: String
    title: String
    description: String
    location: String
    startAtUtc: DateTime!
    endAtUtc: DateTime!
    originalTimezone: String
    allDay: Boolean!
  }

  type WorkspaceCalendarItemObjectType {
    id: String!
    subscriptionId: String!
    sortOrder: Int
    colorOverride: String
    enabled: Boolean!
  }

  type WorkspaceCalendarObjectType {
    id: String!
    workspaceId: String!
    createdByUserId: String!
    displayNameOverride: String
    colorOverride: String
    enabled: Boolean!
    items: [WorkspaceCalendarItemObjectType!]!
    events(from: DateTime!, to: DateTime!): [CalendarEventObjectType!]!
  }

  input LinkCalendarAccountInput {
    provider: CalendarProviderType!
    redirectUri: String
  }

  input LinkCalDAVAccountInput {
    providerPresetId: String!
    username: String!
    password: String!
    displayName: String
  }

  input WorkspaceCalendarItemInput {
    colorOverride: String
    sortOrder: Int
    subscriptionId: String!
  }

  input UpdateWorkspaceCalendarsInput {
    items: [WorkspaceCalendarItemInput!]!
    workspaceId: String!
  }

  extend type ServerConfigType {
    calendarCalDAVProviders: [CalendarCalDAVProviderPresetObjectType!]!
  }

  extend type UserType {
    calendarAccounts: [CalendarAccountObjectType!]!
  }

  extend type WorkspaceType {
    calendars: [WorkspaceCalendarObjectType!]!
  }

  extend type Mutation {
    linkCalendarAccount(input: LinkCalendarAccountInput!): String!
    linkCalDAVAccount(input: LinkCalDAVAccountInput!): CalendarAccountObjectType!
    unlinkCalendarAccount(accountId: String!): Boolean!
    updateCalendarAccount(
      accountId: String!
      refreshIntervalMinutes: Int!
    ): CalendarAccountObjectType!
    updateWorkspaceCalendars(
      input: UpdateWorkspaceCalendarsInput!
    ): WorkspaceCalendarObjectType!
  }
`;

export interface CalendarGraphqlOpts {
  auth: AuthService;
  calendar: CalendarService;
  requestOf: (ctx: { request?: FastifyRequest }) => FastifyRequest | undefined;
}

export function calendarResolvers(opts: CalendarGraphqlOpts) {
  const userOf = async (ctx: { request?: FastifyRequest }): Promise<User> =>
    opts.auth.requireUser(opts.requestOf(ctx)?.authSession ?? null);

  const gqlAccount = async (account: {
    id: string;
    provider: string;
    providerAccountId: string;
    displayName: string | null;
    email: string | null;
    status: string;
    lastError: string | null;
    refreshIntervalMinutes: number;
    createdAt: Date;
    updatedAt: Date;
  }) => {
    const calendars = await opts.calendar.listSubscriptions(account.id);
    return {
      ...account,
      calendarsCount: calendars.length,
      calendars,
    };
  };

  return {
    ServerConfigType: {
      calendarCalDAVProviders: () => opts.calendar.caldavPresets(),
    },
    UserType: {
      calendarAccounts: async (
        _parent: unknown,
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          const accounts = await opts.calendar.listAccounts(user);
          return Promise.all(accounts.map(account => gqlAccount(account)));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    WorkspaceType: {
      calendars: async (
        parent: { id: string },
        _args: unknown,
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.calendar.workspaceCalendars(user, parent.id);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
    WorkspaceCalendarObjectType: {
      items: async (parent: { id: string }) => opts.calendar.listItems(parent.id),
      events: async (
        parent: { id: string },
        args: { from: string | Date; to: string | Date }
      ) => {
        const items = await opts.calendar.listItems(parent.id);
        const from = new Date(args.from);
        const to = new Date(args.to);
        const nested = await Promise.all(
          items.map(item => opts.calendar.events(item.subscriptionId, from, to))
        );
        return nested.flat();
      },
    },
    Mutation: {
      linkCalendarAccount: async (
        _root: unknown,
        args: { input: { provider: string; redirectUri?: string | null } },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          if (args.input.provider !== 'Google') {
            throw errors.badRequest('Use linkCalDAVAccount for CalDAV providers.');
          }
          return opts.calendar.linkGoogle(user, {
            ...(args.input.redirectUri !== undefined
              ? { redirectUri: args.input.redirectUri }
              : {}),
          });
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      linkCalDAVAccount: async (
        _root: unknown,
        args: {
          input: {
            providerPresetId: string;
            username: string;
            password: string;
            displayName?: string | null;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return gqlAccount(await opts.calendar.linkCalDav(user, args.input));
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      unlinkCalendarAccount: async (
        _root: unknown,
        args: { accountId: string },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.calendar.unlink(user, args.accountId);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateCalendarAccount: async (
        _root: unknown,
        args: { accountId: string; refreshIntervalMinutes: number },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return gqlAccount(
            await opts.calendar.updateAccount(
              user,
              args.accountId,
              args.refreshIntervalMinutes
            )
          );
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
      updateWorkspaceCalendars: async (
        _root: unknown,
        args: {
          input: {
            workspaceId: string;
            items: Array<{
              subscriptionId: string;
              sortOrder?: number | null;
              colorOverride?: string | null;
            }>;
          };
        },
        ctx: { request?: FastifyRequest }
      ) => {
        try {
          const user = await userOf(ctx);
          return opts.calendar.updateWorkspaceCalendars(user, args.input);
        } catch (error) {
          throw toGraphQLError(error);
        }
      },
    },
  };
}
