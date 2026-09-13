import { describe, expect, it } from 'vitest';

import { reportGraphqlSurface } from '../../scripts/graphql-surface.js';

describe('E-Plat GraphQL surface gate', () => {
  it('classifies every MIT .gql document as implemented or wontfix', () => {
    const report = reportGraphqlSurface();
    expect(report.unclassified).toEqual([]);
    expect(report.implemented).toEqual(
      expect.arrayContaining([
        'admin/config.gql',
        'admin/update-config.gql',
        'admin/validate-config.gql',
        'list-notifications.gql',
        'read-notification.gql',
        'read-all-notifications.gql',
        'mention-user.gql',
        'get-user-settings.gql',
        'update-user-settings.gql',
        'admin/list-users.gql',
        'admin/create-user.gql',
        'admin/import-users.gql',
        'admin/admin-workspaces.gql',
        'admin/admin-server-config.gql',
        'admin/auth-signing-keys.gql',
      ])
    );
  });
});
