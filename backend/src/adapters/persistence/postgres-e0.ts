import type postgres from 'postgres';

import type {
  MfaChallenge,
  RecoveryCode,
  TotpCredential,
  WebAuthnCredential,
} from '../../domain/mfa.js';
import type {
  Organization,
  OrganizationIdp,
  OrgDomain,
  OrgMember,
  OrgRole,
} from '../../domain/org.js';
import type { MfaStore, OrgStore, ScimStore } from '../../domain/ports.js';
import type { ScimGroup, ScimListQuery, ScimToken, ScimUser } from '../../domain/scim.js';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  jit_enabled: boolean;
  require_mfa: Organization['requireMfa'];
  ip_allowlist: string[];
  audit_retention_days: number | null;
  created_at: Date;
  updated_at: Date;
}

interface MemberRow {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: Date;
}

interface DomainRow {
  id: string;
  org_id: string;
  domain: string;
  token: string;
  verified_at: Date | null;
  created_at: Date;
}

interface IdpRow {
  id: string;
  org_id: string;
  kind: OrganizationIdp['kind'];
  enabled: boolean;
  issuer: string | null;
  client_id: string | null;
  client_secret: string | null;
  sso_url: string | null;
  entity_id: string | null;
  certificate: string | null;
  group_claim: string | null;
  group_role_map: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

function mapOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    jitEnabled: row.jit_enabled,
    requireMfa: row.require_mfa,
    ipAllowlist: row.ip_allowlist ?? [],
    auditRetentionDays: row.audit_retention_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: MemberRow): OrgMember {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

function mapDomain(row: DomainRow): OrgDomain {
  return {
    id: row.id,
    orgId: row.org_id,
    domain: row.domain,
    token: row.token,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

function mapIdp(row: IdpRow): OrganizationIdp {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind,
    enabled: row.enabled,
    issuer: row.issuer,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    ssoUrl: row.sso_url,
    entityId: row.entity_id,
    certificate: row.certificate,
    groupClaim: row.group_claim,
    groupRoleMap: row.group_role_map ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asJson(value: unknown): postgres.JSONValue {
  const serialized = JSON.parse(
    JSON.stringify(value ?? null)
  ) as postgres.JSONValue;
  if (serialized !== null && typeof serialized === 'object') {
    return serialized;
  }
  return { value: serialized };
}

function scimUserFilterSql(
  filter: string | null | undefined
): { field: string; value: string } | null {
  if (!filter?.trim()) {
    return null;
  }
  const match = /^(\w+)\s+eq\s+"([^"]*)"$/i.exec(filter.trim());
  if (!match) {
    return null;
  }
  return { field: match[1]!.toLowerCase(), value: match[2]! };
}

export class PostgresE0Store implements OrgStore, ScimStore, MfaStore {
  constructor(protected readonly sql: postgres.Sql) {}

  async createOrganization(org: Organization): Promise<Organization> {
    await this.sql`
      INSERT INTO organizations (
        id, name, slug, jit_enabled, require_mfa, ip_allowlist, audit_retention_days, created_at, updated_at
      ) VALUES (
        ${org.id}, ${org.name}, ${org.slug}, ${org.jitEnabled}, ${org.requireMfa},
        ${org.ipAllowlist}, ${org.auditRetentionDays}, ${org.createdAt}, ${org.updatedAt}
      )
    `;
    return org;
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const [row] = await this.sql<OrgRow[]>`SELECT * FROM organizations WHERE id = ${id}`;
    return row ? mapOrg(row) : null;
  }

  async getDefaultOrganization(): Promise<Organization | null> {
    const [row] = await this.sql<
      OrgRow[]
    >`SELECT * FROM organizations ORDER BY created_at ASC, id ASC LIMIT 1`;
    return row ? mapOrg(row) : null;
  }

  async updateOrganization(
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
  ): Promise<Organization> {
    const current = await this.getOrganization(id);
    if (!current) {
      throw new Error('organization not found');
    }
    const next: Organization = {
      ...current,
      ...patch,
      ipAllowlist: patch.ipAllowlist ?? current.ipAllowlist,
      updatedAt: new Date(),
    };
    await this.sql`
      UPDATE organizations SET
        name = ${next.name},
        jit_enabled = ${next.jitEnabled},
        require_mfa = ${next.requireMfa},
        ip_allowlist = ${next.ipAllowlist},
        audit_retention_days = ${next.auditRetentionDays},
        updated_at = ${next.updatedAt}
      WHERE id = ${id}
    `;
    return next;
  }

  async addOrgMember(member: OrgMember): Promise<OrgMember> {
    await this.sql`
      INSERT INTO org_members (org_id, user_id, role, created_at)
      VALUES (${member.orgId}, ${member.userId}, ${member.role}, ${member.createdAt})
      ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
    return member;
  }

  async getOrgMember(orgId: string, userId: string): Promise<OrgMember | null> {
    const [row] = await this.sql<MemberRow[]>`
      SELECT * FROM org_members WHERE org_id = ${orgId} AND user_id = ${userId}
    `;
    return row ? mapMember(row) : null;
  }

  async getOrgMembership(userId: string): Promise<OrgMember | null> {
    const [row] = await this.sql<MemberRow[]>`
      SELECT * FROM org_members WHERE user_id = ${userId} LIMIT 1
    `;
    return row ? mapMember(row) : null;
  }

  async listOrgMembers(orgId: string): Promise<OrgMember[]> {
    const rows = await this.sql<MemberRow[]>`
      SELECT * FROM org_members WHERE org_id = ${orgId}
    `;
    return rows.map(mapMember);
  }

  async updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: OrgRole
  ): Promise<void> {
    await this.sql`
      UPDATE org_members SET role = ${role}
      WHERE org_id = ${orgId} AND user_id = ${userId}
    `;
  }

  async createOrgDomain(domain: OrgDomain): Promise<OrgDomain> {
    await this.sql`
      INSERT INTO org_domains (id, org_id, domain, token, verified_at, created_at)
      VALUES (${domain.id}, ${domain.orgId}, ${domain.domain}, ${domain.token}, ${domain.verifiedAt}, ${domain.createdAt})
    `;
    return domain;
  }

  async listOrgDomains(orgId: string): Promise<OrgDomain[]> {
    const rows = await this.sql<DomainRow[]>`
      SELECT * FROM org_domains WHERE org_id = ${orgId} ORDER BY domain
    `;
    return rows.map(mapDomain);
  }

  async getOrgDomain(id: string): Promise<OrgDomain | null> {
    const [row] = await this.sql<DomainRow[]>`SELECT * FROM org_domains WHERE id = ${id}`;
    return row ? mapDomain(row) : null;
  }

  async findOrgDomainByName(
    orgId: string,
    domain: string
  ): Promise<OrgDomain | null> {
    const [row] = await this.sql<DomainRow[]>`
      SELECT * FROM org_domains WHERE org_id = ${orgId} AND domain = ${domain.toLowerCase()}
    `;
    return row ? mapDomain(row) : null;
  }

  async findVerifiedDomain(domain: string): Promise<OrgDomain | null> {
    const [row] = await this.sql<DomainRow[]>`
      SELECT * FROM org_domains
      WHERE domain = ${domain.toLowerCase()} AND verified_at IS NOT NULL
      LIMIT 1
    `;
    return row ? mapDomain(row) : null;
  }

  async updateOrgDomain(
    id: string,
    patch: Partial<Pick<OrgDomain, 'verifiedAt'>>
  ): Promise<OrgDomain> {
    const current = await this.getOrgDomain(id);
    if (!current) {
      throw new Error('domain not found');
    }
    const next = { ...current, ...patch };
    await this.sql`
      UPDATE org_domains SET verified_at = ${next.verifiedAt} WHERE id = ${id}
    `;
    return next;
  }

  async deleteOrgDomain(id: string): Promise<boolean> {
    const rows = await this.sql`DELETE FROM org_domains WHERE id = ${id}`;
    return rows.count > 0;
  }

  async upsertOrgIdp(idp: OrganizationIdp): Promise<OrganizationIdp> {
    await this.sql`
      INSERT INTO organization_idp (
        id, org_id, kind, enabled, issuer, client_id, client_secret, sso_url,
        entity_id, certificate, group_claim, group_role_map, created_at, updated_at
      ) VALUES (
        ${idp.id}, ${idp.orgId}, ${idp.kind}, ${idp.enabled}, ${idp.issuer},
        ${idp.clientId}, ${idp.clientSecret}, ${idp.ssoUrl}, ${idp.entityId},
        ${idp.certificate}, ${idp.groupClaim}, ${this.sql.json(asJson(idp.groupRoleMap))},
        ${idp.createdAt}, ${idp.updatedAt}
      )
      ON CONFLICT (org_id) DO UPDATE SET
        kind = EXCLUDED.kind,
        enabled = EXCLUDED.enabled,
        issuer = EXCLUDED.issuer,
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        sso_url = EXCLUDED.sso_url,
        entity_id = EXCLUDED.entity_id,
        certificate = EXCLUDED.certificate,
        group_claim = EXCLUDED.group_claim,
        group_role_map = EXCLUDED.group_role_map,
        updated_at = EXCLUDED.updated_at
    `;
    return idp;
  }

  async getOrgIdp(orgId: string): Promise<OrganizationIdp | null> {
    const [row] = await this.sql<IdpRow[]>`
      SELECT * FROM organization_idp WHERE org_id = ${orgId}
    `;
    return row ? mapIdp(row) : null;
  }

  async createScimToken(token: ScimToken): Promise<ScimToken> {
    await this.sql`
      INSERT INTO scim_tokens (id, org_id, name, token_hash, created_at, last_used_at)
      VALUES (${token.id}, ${token.orgId}, ${token.name}, ${token.tokenHash}, ${token.createdAt}, ${token.lastUsedAt})
    `;
    return token;
  }

  async findScimTokenByHash(tokenHash: string): Promise<ScimToken | null> {
    const [row] = await this.sql<
      {
        id: string;
        org_id: string;
        name: string;
        token_hash: string;
        created_at: Date;
        last_used_at: Date | null;
      }[]
    >`SELECT * FROM scim_tokens WHERE token_hash = ${tokenHash}`;
    return row
      ? {
          id: row.id,
          orgId: row.org_id,
          name: row.name,
          tokenHash: row.token_hash,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
        }
      : null;
  }

  async listScimTokens(orgId: string): Promise<ScimToken[]> {
    const rows = await this.sql<
      {
        id: string;
        org_id: string;
        name: string;
        token_hash: string;
        created_at: Date;
        last_used_at: Date | null;
      }[]
    >`SELECT * FROM scim_tokens WHERE org_id = ${orgId} ORDER BY created_at`;
    return rows.map(row => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  async deleteScimToken(id: string): Promise<boolean> {
    const rows = await this.sql`DELETE FROM scim_tokens WHERE id = ${id}`;
    return rows.count > 0;
  }

  async touchScimToken(id: string, at: Date): Promise<void> {
    await this.sql`UPDATE scim_tokens SET last_used_at = ${at} WHERE id = ${id}`;
  }

  async createScimUser(user: ScimUser): Promise<ScimUser> {
    await this.sql`
      INSERT INTO scim_users (
        id, org_id, user_id, external_id, user_name, display_name, active, emails, created_at, updated_at
      ) VALUES (
        ${user.id}, ${user.orgId}, ${user.userId}, ${user.externalId}, ${user.userName},
        ${user.displayName}, ${user.active}, ${user.emails}, ${user.createdAt}, ${user.updatedAt}
      )
    `;
    return user;
  }

  async getScimUser(id: string): Promise<ScimUser | null> {
    const [row] = await this.sql<ScimUserRow[]>`SELECT * FROM scim_users WHERE id = ${id}`;
    return row ? mapScimUser(row) : null;
  }

  async findScimUserByExternalId(
    orgId: string,
    externalId: string
  ): Promise<ScimUser | null> {
    const [row] = await this.sql<ScimUserRow[]>`
      SELECT * FROM scim_users WHERE org_id = ${orgId} AND external_id = ${externalId}
    `;
    return row ? mapScimUser(row) : null;
  }

  async findScimUserByUserName(
    orgId: string,
    userName: string
  ): Promise<ScimUser | null> {
    const [row] = await this.sql<ScimUserRow[]>`
      SELECT * FROM scim_users WHERE org_id = ${orgId} AND lower(user_name) = ${userName.toLowerCase()}
    `;
    return row ? mapScimUser(row) : null;
  }

  async listScimUsers(orgId: string, query: ScimListQuery): Promise<ScimUser[]> {
    const parsed = scimUserFilterSql(query.filter);
    const start = Math.max(0, query.startIndex - 1);
    if (parsed?.field === 'username') {
      const rows = await this.sql<ScimUserRow[]>`
        SELECT * FROM scim_users
        WHERE org_id = ${orgId} AND lower(user_name) = ${parsed.value.toLowerCase()}
        ORDER BY id OFFSET ${start} LIMIT ${query.count}
      `;
      return rows.map(mapScimUser);
    }
    if (parsed?.field === 'externalid') {
      const rows = await this.sql<ScimUserRow[]>`
        SELECT * FROM scim_users
        WHERE org_id = ${orgId} AND external_id = ${parsed.value}
        ORDER BY id OFFSET ${start} LIMIT ${query.count}
      `;
      return rows.map(mapScimUser);
    }
    const rows = await this.sql<ScimUserRow[]>`
      SELECT * FROM scim_users WHERE org_id = ${orgId}
      ORDER BY id OFFSET ${start} LIMIT ${query.count}
    `;
    return rows.map(mapScimUser);
  }

  async countScimUsers(orgId: string, filter?: string | null): Promise<number> {
    const parsed = scimUserFilterSql(filter);
    if (parsed?.field === 'username') {
      const [row] = await this.sql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM scim_users
        WHERE org_id = ${orgId} AND lower(user_name) = ${parsed.value.toLowerCase()}
      `;
      return Number(row?.count ?? 0);
    }
    const [row] = await this.sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM scim_users WHERE org_id = ${orgId}
    `;
    return Number(row?.count ?? 0);
  }

  async updateScimUser(
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
  ): Promise<ScimUser> {
    const current = await this.getScimUser(id);
    if (!current) {
      throw new Error('scim user not found');
    }
    const next: ScimUser = {
      ...current,
      ...patch,
      emails: patch.emails ?? current.emails,
      updatedAt: new Date(),
    };
    await this.sql`
      UPDATE scim_users SET
        user_id = ${next.userId},
        external_id = ${next.externalId},
        user_name = ${next.userName},
        display_name = ${next.displayName},
        active = ${next.active},
        emails = ${next.emails},
        updated_at = ${next.updatedAt}
      WHERE id = ${id}
    `;
    return next;
  }

  async deleteScimUser(id: string): Promise<boolean> {
    const rows = await this.sql`DELETE FROM scim_users WHERE id = ${id}`;
    return rows.count > 0;
  }

  async createScimGroup(group: ScimGroup): Promise<ScimGroup> {
    await this.sql`
      INSERT INTO scim_groups (id, org_id, external_id, display_name, members, created_at, updated_at)
      VALUES (${group.id}, ${group.orgId}, ${group.externalId}, ${group.displayName}, ${group.members}, ${group.createdAt}, ${group.updatedAt})
    `;
    return group;
  }

  async getScimGroup(id: string): Promise<ScimGroup | null> {
    const [row] = await this.sql<ScimGroupRow[]>`SELECT * FROM scim_groups WHERE id = ${id}`;
    return row ? mapScimGroup(row) : null;
  }

  async listScimGroups(
    orgId: string,
    query: ScimListQuery
  ): Promise<ScimGroup[]> {
    const start = Math.max(0, query.startIndex - 1);
    const rows = await this.sql<ScimGroupRow[]>`
      SELECT * FROM scim_groups WHERE org_id = ${orgId}
      ORDER BY id OFFSET ${start} LIMIT ${query.count}
    `;
    return rows.map(mapScimGroup);
  }

  async countScimGroups(orgId: string): Promise<number> {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM scim_groups WHERE org_id = ${orgId}
    `;
    return Number(row?.count ?? 0);
  }

  async updateScimGroup(
    id: string,
    patch: Partial<Pick<ScimGroup, 'externalId' | 'displayName' | 'members'>>
  ): Promise<ScimGroup> {
    const current = await this.getScimGroup(id);
    if (!current) {
      throw new Error('scim group not found');
    }
    const next: ScimGroup = {
      ...current,
      ...patch,
      members: patch.members ?? current.members,
      updatedAt: new Date(),
    };
    await this.sql`
      UPDATE scim_groups SET
        external_id = ${next.externalId},
        display_name = ${next.displayName},
        members = ${next.members},
        updated_at = ${next.updatedAt}
      WHERE id = ${id}
    `;
    return next;
  }

  async deleteScimGroup(id: string): Promise<boolean> {
    const rows = await this.sql`DELETE FROM scim_groups WHERE id = ${id}`;
    return rows.count > 0;
  }

  async upsertTotp(record: TotpCredential): Promise<TotpCredential> {
    await this.sql`
      INSERT INTO user_totp (user_id, secret, verified_at, created_at)
      VALUES (${record.userId}, ${record.secret}, ${record.verifiedAt}, ${record.createdAt})
      ON CONFLICT (user_id) DO UPDATE SET
        secret = EXCLUDED.secret,
        verified_at = EXCLUDED.verified_at
    `;
    return record;
  }

  async getTotp(userId: string): Promise<TotpCredential | null> {
    const [row] = await this.sql<
      { user_id: string; secret: string; verified_at: Date | null; created_at: Date }[]
    >`SELECT * FROM user_totp WHERE user_id = ${userId}`;
    return row
      ? {
          userId: row.user_id,
          secret: row.secret,
          verifiedAt: row.verified_at,
          createdAt: row.created_at,
        }
      : null;
  }

  async deleteTotp(userId: string): Promise<void> {
    await this.sql`DELETE FROM user_totp WHERE user_id = ${userId}`;
  }

  async addWebAuthn(record: WebAuthnCredential): Promise<WebAuthnCredential> {
    await this.sql`
      INSERT INTO webauthn_credentials (
        id, user_id, credential_id, public_key, counter, device_name, created_at
      ) VALUES (
        ${record.id}, ${record.userId}, ${record.credentialId}, ${record.publicKey},
        ${record.counter}, ${record.deviceName}, ${record.createdAt}
      )
    `;
    return record;
  }

  async listWebAuthn(userId: string): Promise<WebAuthnCredential[]> {
    const rows = await this.sql<WebAuthnRow[]>`
      SELECT * FROM webauthn_credentials WHERE user_id = ${userId}
    `;
    return rows.map(mapWebAuthn);
  }

  async getWebAuthnByCredentialId(
    credentialId: string
  ): Promise<WebAuthnCredential | null> {
    const [row] = await this.sql<WebAuthnRow[]>`
      SELECT * FROM webauthn_credentials WHERE credential_id = ${credentialId}
    `;
    return row ? mapWebAuthn(row) : null;
  }

  async updateWebAuthnCounter(id: string, counter: number): Promise<void> {
    await this.sql`UPDATE webauthn_credentials SET counter = ${counter} WHERE id = ${id}`;
  }

  async deleteWebAuthn(id: string, userId: string): Promise<boolean> {
    const rows = await this.sql`
      DELETE FROM webauthn_credentials WHERE id = ${id} AND user_id = ${userId}
    `;
    return rows.count > 0;
  }

  async replaceRecoveryCodes(
    userId: string,
    codes: RecoveryCode[]
  ): Promise<void> {
    await this.sql.begin(async tx => {
      await tx`DELETE FROM recovery_codes WHERE user_id = ${userId}`;
      for (const code of codes) {
        await tx`
          INSERT INTO recovery_codes (user_id, code_hash, used_at)
          VALUES (${code.userId}, ${code.codeHash}, ${code.usedAt})
        `;
      }
    });
  }

  async listRecoveryCodes(userId: string): Promise<RecoveryCode[]> {
    const rows = await this.sql<
      { user_id: string; code_hash: string; used_at: Date | null }[]
    >`SELECT * FROM recovery_codes WHERE user_id = ${userId}`;
    return rows.map(row => ({
      userId: row.user_id,
      codeHash: row.code_hash,
      usedAt: row.used_at,
    }));
  }

  async consumeRecoveryCode(
    userId: string,
    codeHash: string,
    at: Date
  ): Promise<boolean> {
    const rows = await this.sql`
      UPDATE recovery_codes SET used_at = ${at}
      WHERE user_id = ${userId} AND code_hash = ${codeHash} AND used_at IS NULL
    `;
    return rows.count > 0;
  }

  async createMfaChallenge(challenge: MfaChallenge): Promise<MfaChallenge> {
    await this.sql`
      INSERT INTO mfa_challenges (id, user_id, token_hash, purpose, payload, expires_at, created_at)
      VALUES (
        ${challenge.id}, ${challenge.userId}, ${challenge.tokenHash}, ${challenge.purpose},
        ${this.sql.json(asJson(challenge.payload))}, ${challenge.expiresAt}, ${challenge.createdAt}
      )
    `;
    return challenge;
  }

  async findMfaChallengeByHash(
    tokenHash: string
  ): Promise<MfaChallenge | null> {
    const [row] = await this.sql<
      {
        id: string;
        user_id: string;
        token_hash: string;
        purpose: MfaChallenge['purpose'];
        payload: Record<string, unknown>;
        expires_at: Date;
        created_at: Date;
      }[]
    >`SELECT * FROM mfa_challenges WHERE token_hash = ${tokenHash}`;
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          tokenHash: row.token_hash,
          purpose: row.purpose,
          payload: row.payload ?? {},
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        }
      : null;
  }

  async deleteMfaChallenge(id: string): Promise<void> {
    await this.sql`DELETE FROM mfa_challenges WHERE id = ${id}`;
  }
}

interface ScimUserRow {
  id: string;
  org_id: string;
  user_id: string | null;
  external_id: string;
  user_name: string;
  display_name: string;
  active: boolean;
  emails: string[];
  created_at: Date;
  updated_at: Date;
}

interface ScimGroupRow {
  id: string;
  org_id: string;
  external_id: string;
  display_name: string;
  members: string[];
  created_at: Date;
  updated_at: Date;
}

interface WebAuthnRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: string | number | bigint;
  device_name: string | null;
  created_at: Date;
}

function mapScimUser(row: ScimUserRow): ScimUser {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    externalId: row.external_id,
    userName: row.user_name,
    displayName: row.display_name,
    active: row.active,
    emails: row.emails ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScimGroup(row: ScimGroupRow): ScimGroup {
  return {
    id: row.id,
    orgId: row.org_id,
    externalId: row.external_id,
    displayName: row.display_name,
    members: row.members ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWebAuthn(row: WebAuthnRow): WebAuthnCredential {
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: Number(row.counter),
    deviceName: row.device_name,
    createdAt: row.created_at,
  };
}
