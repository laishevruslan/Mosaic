import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import {
  isMfaPolicy,
  type MfaPolicy,
  type Organization,
  type OrganizationIdp,
  type OrgDomain,
  type OrgRole,
} from '../domain/org.js';
import type {
  Clock,
  DnsResolver,
  IdentityStore,
  OrgStore,
} from '../domain/ports.js';
import { randomToken } from './crypto.js';
import type { AuditService } from './audit-service.js';

const TXT_PREFIX = 'mosaic-domain-verification=';

export class OrgService {
  constructor(
    private readonly orgs: OrgStore,
    private readonly identity: IdentityStore,
    private readonly clock: Clock,
    private readonly dns: DnsResolver,
    private readonly audit?: AuditService
  ) {}

  async ensureDefault(user: User, name = 'Mosaic'): Promise<Organization> {
    const existing = await this.orgs.getDefaultOrganization();
    if (existing) {
      const member = await this.orgs.getOrgMember(existing.id, user.id);
      if (!member) {
        await this.orgs.addOrgMember({
          orgId: existing.id,
          userId: user.id,
          role: user.features.includes('Admin') ? 'owner' : 'member',
          createdAt: this.clock.now(),
        });
      }
      return existing;
    }
    const now = this.clock.now();
    const org = await this.orgs.createOrganization({
      id: crypto.randomUUID(),
      name,
      slug: 'default',
      jitEnabled: true,
      requireMfa: 'off',
      ipAllowlist: [],
      auditRetentionDays: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.orgs.addOrgMember({
      orgId: org.id,
      userId: user.id,
      role: 'owner',
      createdAt: now,
    });
    return org;
  }

  async default(): Promise<Organization | null> {
    return this.orgs.getDefaultOrganization();
  }

  async requireOrgAdmin(user: User): Promise<Organization> {
    const org = await this.orgs.getDefaultOrganization();
    if (!org) {
      throw errors.orgNotFound();
    }
    if (user.features.includes('Admin')) {
      return org;
    }
    const member = await this.orgs.getOrgMember(org.id, user.id);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw errors.accessDenied();
    }
    return org;
  }

  async membershipOf(userId: string) {
    return this.orgs.getOrgMembership(userId);
  }

  async addMember(
    orgId: string,
    userId: string,
    role: OrgRole
  ): Promise<void> {
    await this.orgs.addOrgMember({
      orgId,
      userId,
      role,
      createdAt: this.clock.now(),
    });
  }

  async update(
    user: User,
    patch: Partial<
      Pick<
        Organization,
        'name' | 'jitEnabled' | 'requireMfa' | 'ipAllowlist' | 'auditRetentionDays'
      >
    >
  ): Promise<Organization> {
    const org = await this.requireOrgAdmin(user);
    if (patch.requireMfa && !isMfaPolicy(patch.requireMfa)) {
      throw errors.badRequest('Invalid MFA policy.');
    }
    return this.orgs.updateOrganization(org.id, patch);
  }

  async listDomains(user: User): Promise<OrgDomain[]> {
    const org = await this.requireOrgAdmin(user);
    return this.orgs.listOrgDomains(org.id);
  }

  async addDomain(user: User, domain: string): Promise<OrgDomain> {
    const org = await this.requireOrgAdmin(user);
    const normalized = domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
      throw errors.badRequest('Invalid domain.');
    }
    const existing = await this.orgs.findOrgDomainByName(org.id, normalized);
    if (existing) {
      return existing;
    }
    return this.orgs.createOrgDomain({
      id: crypto.randomUUID(),
      orgId: org.id,
      domain: normalized,
      token: randomToken(16),
      verifiedAt: null,
      createdAt: this.clock.now(),
    });
  }

  async verifyDomain(user: User, domainId: string): Promise<OrgDomain> {
    const org = await this.requireOrgAdmin(user);
    const domain = await this.orgs.getOrgDomain(domainId);
    if (!domain || domain.orgId !== org.id) {
      throw errors.badRequest('Domain not found.');
    }
    const records = await this.dns.resolveTxt(domain.domain).catch(() => []);
    const expected = `${TXT_PREFIX}${domain.token}`;
    const ok = records.some(chunk => chunk.join('').includes(expected));
    if (!ok) {
      throw errors.badRequest(
        `Add a DNS TXT record: ${expected}`
      );
    }
    const verified = await this.orgs.updateOrgDomain(domain.id, {
      verifiedAt: this.clock.now(),
    });
    await this.audit?.record({
      actorId: user.id,
      action: 'org.domain_verify',
      targetType: 'domain',
      targetId: domain.domain,
    });
    return verified;
  }

  async deleteDomain(user: User, domainId: string): Promise<boolean> {
    const org = await this.requireOrgAdmin(user);
    const domain = await this.orgs.getOrgDomain(domainId);
    if (!domain || domain.orgId !== org.id) {
      return false;
    }
    return this.orgs.deleteOrgDomain(domainId);
  }

  async findVerifiedDomain(domain: string): Promise<OrgDomain | null> {
    return this.orgs.findVerifiedDomain(domain.toLowerCase());
  }

  async upsertIdp(
    user: User,
    input: Partial<Omit<OrganizationIdp, 'id' | 'orgId' | 'createdAt'>> & {
      kind: OrganizationIdp['kind'];
    }
  ): Promise<OrganizationIdp> {
    const org = await this.requireOrgAdmin(user);
    const current = await this.orgs.getOrgIdp(org.id);
    const now = this.clock.now();
    const next: OrganizationIdp = {
      id: current?.id ?? crypto.randomUUID(),
      orgId: org.id,
      kind: input.kind,
      enabled: input.enabled ?? current?.enabled ?? true,
      issuer: input.issuer ?? current?.issuer ?? null,
      clientId: input.clientId ?? current?.clientId ?? null,
      clientSecret: input.clientSecret ?? current?.clientSecret ?? null,
      ssoUrl: input.ssoUrl ?? current?.ssoUrl ?? null,
      entityId: input.entityId ?? current?.entityId ?? null,
      certificate: input.certificate ?? current?.certificate ?? null,
      groupClaim: input.groupClaim ?? current?.groupClaim ?? 'groups',
      groupRoleMap: input.groupRoleMap ?? current?.groupRoleMap ?? {},
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    return this.orgs.upsertOrgIdp(next);
  }

  async getIdp(orgId: string): Promise<OrganizationIdp | null> {
    return this.orgs.getOrgIdp(orgId);
  }

  mfaPolicy(org: Organization | null): MfaPolicy {
    return org?.requireMfa ?? 'off';
  }
}
