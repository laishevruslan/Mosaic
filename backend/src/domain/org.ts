export type OrgRole = 'owner' | 'admin' | 'member';

export type MfaPolicy = 'off' | 'all' | 'if_not_sso';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  jitEnabled: boolean;
  requireMfa: MfaPolicy;
  ipAllowlist: string[];
  auditRetentionDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: Date;
}

export interface OrgDomain {
  id: string;
  orgId: string;
  domain: string;
  token: string;
  verifiedAt: Date | null;
  createdAt: Date;
}

export type IdpKind = 'oidc' | 'saml';

export interface OrganizationIdp {
  id: string;
  orgId: string;
  kind: IdpKind;
  enabled: boolean;
  issuer: string | null;
  clientId: string | null;
  clientSecret: string | null;
  ssoUrl: string | null;
  entityId: string | null;
  certificate: string | null;
  groupClaim: string | null;
  groupRoleMap: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export function isOrgRole(value: string): value is OrgRole {
  return value === 'owner' || value === 'admin' || value === 'member';
}

export function isMfaPolicy(value: string): value is MfaPolicy {
  return value === 'off' || value === 'all' || value === 'if_not_sso';
}
