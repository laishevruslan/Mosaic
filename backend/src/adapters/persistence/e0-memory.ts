import type { MfaChallenge, RecoveryCode, TotpCredential, WebAuthnCredential } from '../../domain/mfa.js';
import type {
  Organization,
  OrganizationIdp,
  OrgDomain,
  OrgMember,
  OrgRole,
} from '../../domain/org.js';
import type { ScimGroup, ScimListQuery, ScimToken, ScimUser } from '../../domain/scim.js';
import type { MfaStore, OrgStore, ScimStore } from '../../domain/ports.js';

function cloneOrg(org: Organization): Organization {
  return {
    ...org,
    ipAllowlist: [...org.ipAllowlist],
    createdAt: new Date(org.createdAt),
    updatedAt: new Date(org.updatedAt),
  };
}

function cloneIdp(idp: OrganizationIdp): OrganizationIdp {
  return {
    ...idp,
    groupRoleMap: { ...idp.groupRoleMap },
    createdAt: new Date(idp.createdAt),
    updatedAt: new Date(idp.updatedAt),
  };
}

function cloneScimUser(user: ScimUser): ScimUser {
  return {
    ...user,
    emails: [...user.emails],
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

function cloneScimGroup(group: ScimGroup): ScimGroup {
  return {
    ...group,
    members: [...group.members],
    createdAt: new Date(group.createdAt),
    updatedAt: new Date(group.updatedAt),
  };
}

function matchFilter(
  filter: string | null | undefined,
  fields: Record<string, string>
): boolean {
  if (!filter?.trim()) {
    return true;
  }
  const match = /^(\w+)\s+eq\s+"([^"]*)"$/i.exec(filter.trim());
  if (!match) {
    return true;
  }
  const field = match[1]!.toLowerCase();
  const value = match[2]!.toLowerCase();
  const current = fields[field];
  return current !== undefined && current.toLowerCase() === value;
}

export class MemoryE0Store implements OrgStore, ScimStore, MfaStore {
  private readonly orgs = new Map<string, Organization>();
  private readonly orgMembers = new Map<string, OrgMember[]>();
  private readonly domains = new Map<string, OrgDomain>();
  private readonly idps = new Map<string, OrganizationIdp>();
  private readonly scimTokens = new Map<string, ScimToken>();
  private readonly scimUsers = new Map<string, ScimUser>();
  private readonly scimGroups = new Map<string, ScimGroup>();
  private readonly totp = new Map<string, TotpCredential>();
  private readonly webauthn = new Map<string, WebAuthnCredential>();
  private readonly recovery = new Map<string, RecoveryCode[]>();
  private readonly challenges = new Map<string, MfaChallenge>();

  async createOrganization(org: Organization): Promise<Organization> {
    this.orgs.set(org.id, cloneOrg(org));
    this.orgMembers.set(org.id, []);
    return cloneOrg(org);
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const org = this.orgs.get(id);
    return org ? cloneOrg(org) : null;
  }

  async getDefaultOrganization(): Promise<Organization | null> {
    const first = [...this.orgs.values()].sort((a, b) =>
      a.createdAt.getTime() === b.createdAt.getTime()
        ? a.id.localeCompare(b.id)
        : a.createdAt.getTime() - b.createdAt.getTime()
    )[0];
    return first ? cloneOrg(first) : null;
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
    const current = this.orgs.get(id);
    if (!current) {
      throw new Error('organization not found');
    }
    const next = cloneOrg({
      ...current,
      ...patch,
      ipAllowlist: patch.ipAllowlist
        ? [...patch.ipAllowlist]
        : current.ipAllowlist,
      updatedAt: new Date(),
    });
    this.orgs.set(id, next);
    return cloneOrg(next);
  }

  async addOrgMember(member: OrgMember): Promise<OrgMember> {
    const list = this.orgMembers.get(member.orgId) ?? [];
    const next = list.filter(item => item.userId !== member.userId);
    next.push({ ...member, createdAt: new Date(member.createdAt) });
    this.orgMembers.set(member.orgId, next);
    return { ...member };
  }

  async getOrgMember(orgId: string, userId: string): Promise<OrgMember | null> {
    const member = (this.orgMembers.get(orgId) ?? []).find(
      item => item.userId === userId
    );
    return member ? { ...member } : null;
  }

  async getOrgMembership(userId: string): Promise<OrgMember | null> {
    for (const members of this.orgMembers.values()) {
      const member = members.find(item => item.userId === userId);
      if (member) {
        return { ...member };
      }
    }
    return null;
  }

  async listOrgMembers(orgId: string): Promise<OrgMember[]> {
    return (this.orgMembers.get(orgId) ?? []).map(item => ({ ...item }));
  }

  async updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: OrgRole
  ): Promise<void> {
    const list = this.orgMembers.get(orgId) ?? [];
    this.orgMembers.set(
      orgId,
      list.map(item => (item.userId === userId ? { ...item, role } : item))
    );
  }

  async createOrgDomain(domain: OrgDomain): Promise<OrgDomain> {
    this.domains.set(domain.id, { ...domain });
    return { ...domain };
  }

  async listOrgDomains(orgId: string): Promise<OrgDomain[]> {
    return [...this.domains.values()]
      .filter(item => item.orgId === orgId)
      .map(item => ({ ...item }));
  }

  async getOrgDomain(id: string): Promise<OrgDomain | null> {
    const domain = this.domains.get(id);
    return domain ? { ...domain } : null;
  }

  async findOrgDomainByName(
    orgId: string,
    domain: string
  ): Promise<OrgDomain | null> {
    const found = [...this.domains.values()].find(
      item => item.orgId === orgId && item.domain === domain.toLowerCase()
    );
    return found ? { ...found } : null;
  }

  async findVerifiedDomain(domain: string): Promise<OrgDomain | null> {
    const found = [...this.domains.values()].find(
      item => item.domain === domain.toLowerCase() && item.verifiedAt
    );
    return found ? { ...found } : null;
  }

  async updateOrgDomain(
    id: string,
    patch: Partial<Pick<OrgDomain, 'verifiedAt'>>
  ): Promise<OrgDomain> {
    const current = this.domains.get(id);
    if (!current) {
      throw new Error('domain not found');
    }
    const next = { ...current, ...patch };
    this.domains.set(id, next);
    return { ...next };
  }

  async deleteOrgDomain(id: string): Promise<boolean> {
    return this.domains.delete(id);
  }

  async upsertOrgIdp(idp: OrganizationIdp): Promise<OrganizationIdp> {
    this.idps.set(idp.orgId, cloneIdp(idp));
    return cloneIdp(idp);
  }

  async getOrgIdp(orgId: string): Promise<OrganizationIdp | null> {
    const idp = this.idps.get(orgId);
    return idp ? cloneIdp(idp) : null;
  }

  async createScimToken(token: ScimToken): Promise<ScimToken> {
    this.scimTokens.set(token.id, { ...token });
    return { ...token };
  }

  async findScimTokenByHash(tokenHash: string): Promise<ScimToken | null> {
    const found = [...this.scimTokens.values()].find(
      item => item.tokenHash === tokenHash
    );
    return found ? { ...found } : null;
  }

  async listScimTokens(orgId: string): Promise<ScimToken[]> {
    return [...this.scimTokens.values()]
      .filter(item => item.orgId === orgId)
      .map(item => ({ ...item }));
  }

  async deleteScimToken(id: string): Promise<boolean> {
    return this.scimTokens.delete(id);
  }

  async touchScimToken(id: string, at: Date): Promise<void> {
    const token = this.scimTokens.get(id);
    if (token) {
      this.scimTokens.set(id, { ...token, lastUsedAt: at });
    }
  }

  async createScimUser(user: ScimUser): Promise<ScimUser> {
    this.scimUsers.set(user.id, cloneScimUser(user));
    return cloneScimUser(user);
  }

  async getScimUser(id: string): Promise<ScimUser | null> {
    const user = this.scimUsers.get(id);
    return user ? cloneScimUser(user) : null;
  }

  async findScimUserByExternalId(
    orgId: string,
    externalId: string
  ): Promise<ScimUser | null> {
    const found = [...this.scimUsers.values()].find(
      item => item.orgId === orgId && item.externalId === externalId
    );
    return found ? cloneScimUser(found) : null;
  }

  async findScimUserByUserName(
    orgId: string,
    userName: string
  ): Promise<ScimUser | null> {
    const found = [...this.scimUsers.values()].find(
      item =>
        item.orgId === orgId &&
        item.userName.toLowerCase() === userName.toLowerCase()
    );
    return found ? cloneScimUser(found) : null;
  }

  async listScimUsers(
    orgId: string,
    query: ScimListQuery
  ): Promise<ScimUser[]> {
    const all = [...this.scimUsers.values()]
      .filter(item => item.orgId === orgId)
      .filter(item =>
        matchFilter(query.filter, {
          username: item.userName,
          externalid: item.externalId,
          id: item.id,
        })
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const start = Math.max(0, query.startIndex - 1);
    return all.slice(start, start + query.count).map(cloneScimUser);
  }

  async countScimUsers(orgId: string, filter?: string | null): Promise<number> {
    return [...this.scimUsers.values()].filter(
      item =>
        item.orgId === orgId &&
        matchFilter(filter, {
          username: item.userName,
          externalid: item.externalId,
          id: item.id,
        })
    ).length;
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
    const current = this.scimUsers.get(id);
    if (!current) {
      throw new Error('scim user not found');
    }
    const next = cloneScimUser({
      ...current,
      ...patch,
      emails: patch.emails ? [...patch.emails] : current.emails,
      updatedAt: new Date(),
    });
    this.scimUsers.set(id, next);
    return cloneScimUser(next);
  }

  async deleteScimUser(id: string): Promise<boolean> {
    return this.scimUsers.delete(id);
  }

  async createScimGroup(group: ScimGroup): Promise<ScimGroup> {
    this.scimGroups.set(group.id, cloneScimGroup(group));
    return cloneScimGroup(group);
  }

  async getScimGroup(id: string): Promise<ScimGroup | null> {
    const group = this.scimGroups.get(id);
    return group ? cloneScimGroup(group) : null;
  }

  async listScimGroups(
    orgId: string,
    query: ScimListQuery
  ): Promise<ScimGroup[]> {
    const all = [...this.scimGroups.values()]
      .filter(item => item.orgId === orgId)
      .filter(item =>
        matchFilter(query.filter, {
          displayname: item.displayName,
          externalid: item.externalId,
          id: item.id,
        })
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const start = Math.max(0, query.startIndex - 1);
    return all.slice(start, start + query.count).map(cloneScimGroup);
  }

  async countScimGroups(
    orgId: string,
    filter?: string | null
  ): Promise<number> {
    return [...this.scimGroups.values()].filter(
      item =>
        item.orgId === orgId &&
        matchFilter(filter, {
          displayname: item.displayName,
          externalid: item.externalId,
          id: item.id,
        })
    ).length;
  }

  async updateScimGroup(
    id: string,
    patch: Partial<Pick<ScimGroup, 'externalId' | 'displayName' | 'members'>>
  ): Promise<ScimGroup> {
    const current = this.scimGroups.get(id);
    if (!current) {
      throw new Error('scim group not found');
    }
    const next = cloneScimGroup({
      ...current,
      ...patch,
      members: patch.members ? [...patch.members] : current.members,
      updatedAt: new Date(),
    });
    this.scimGroups.set(id, next);
    return cloneScimGroup(next);
  }

  async deleteScimGroup(id: string): Promise<boolean> {
    return this.scimGroups.delete(id);
  }

  async upsertTotp(record: TotpCredential): Promise<TotpCredential> {
    this.totp.set(record.userId, { ...record });
    return { ...record };
  }

  async getTotp(userId: string): Promise<TotpCredential | null> {
    const row = this.totp.get(userId);
    return row ? { ...row } : null;
  }

  async deleteTotp(userId: string): Promise<void> {
    this.totp.delete(userId);
  }

  async addWebAuthn(record: WebAuthnCredential): Promise<WebAuthnCredential> {
    this.webauthn.set(record.id, { ...record });
    return { ...record };
  }

  async listWebAuthn(userId: string): Promise<WebAuthnCredential[]> {
    return [...this.webauthn.values()]
      .filter(item => item.userId === userId)
      .map(item => ({ ...item }));
  }

  async getWebAuthnByCredentialId(
    credentialId: string
  ): Promise<WebAuthnCredential | null> {
    const found = [...this.webauthn.values()].find(
      item => item.credentialId === credentialId
    );
    return found ? { ...found } : null;
  }

  async updateWebAuthnCounter(id: string, counter: number): Promise<void> {
    const current = this.webauthn.get(id);
    if (current) {
      this.webauthn.set(id, { ...current, counter });
    }
  }

  async deleteWebAuthn(id: string, userId: string): Promise<boolean> {
    const current = this.webauthn.get(id);
    if (!current || current.userId !== userId) {
      return false;
    }
    return this.webauthn.delete(id);
  }

  async replaceRecoveryCodes(
    userId: string,
    codes: RecoveryCode[]
  ): Promise<void> {
    this.recovery.set(
      userId,
      codes.map(code => ({ ...code }))
    );
  }

  async listRecoveryCodes(userId: string): Promise<RecoveryCode[]> {
    return (this.recovery.get(userId) ?? []).map(code => ({ ...code }));
  }

  async consumeRecoveryCode(
    userId: string,
    codeHash: string,
    at: Date
  ): Promise<boolean> {
    const list = this.recovery.get(userId) ?? [];
    const index = list.findIndex(
      item => item.codeHash === codeHash && !item.usedAt
    );
    if (index < 0) {
      return false;
    }
    list[index] = { ...list[index]!, usedAt: at };
    this.recovery.set(userId, list);
    return true;
  }

  async createMfaChallenge(challenge: MfaChallenge): Promise<MfaChallenge> {
    this.challenges.set(challenge.id, {
      ...challenge,
      payload: { ...challenge.payload },
    });
    return { ...challenge, payload: { ...challenge.payload } };
  }

  async findMfaChallengeByHash(
    tokenHash: string
  ): Promise<MfaChallenge | null> {
    const found = [...this.challenges.values()].find(
      item => item.tokenHash === tokenHash
    );
    return found
      ? { ...found, payload: { ...found.payload } }
      : null;
  }

  async deleteMfaChallenge(id: string): Promise<void> {
    this.challenges.delete(id);
  }
}
