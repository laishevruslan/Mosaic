export const API_TOKEN_SCOPES = [
  'read:docs',
  'write:webhooks',
  'admin:scim',
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  fingerprint: string;
  scopes: ApiTokenScope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}
