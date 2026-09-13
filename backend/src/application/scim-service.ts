import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { Organization } from '../domain/org.js';
import type {
  Clock,
  IdentityStore,
  MosaicStore,
} from '../domain/ports.js';
import type { ScimGroup, ScimUser } from '../domain/scim.js';
import { displayNameFromEmail, normalizeEmail, randomToken, sha256 } from './crypto.js';
import type { AuditService } from './audit-service.js';
import type { AuthService } from './auth-service.js';
import type { OrgService } from './org-service.js';

interface ScimName {
  formatted?: string;
  givenName?: string;
  familyName?: string;
}

interface ScimEmail {
  value?: string;
  primary?: boolean;
}

interface ScimUserPayload {
  id?: string;
  userName?: string;
  displayName?: string;
  nickName?: string;
  active?: boolean;
  externalId?: string;
  name?: ScimName;
  emails?: ScimEmail[];
}

interface ScimMemberRef {
  value?: string;
}

interface ScimGroupPayload {
  id?: string;
  displayName?: string;
  externalId?: string;
  members?: ScimMemberRef[];
}

interface ScimPatchOp {
  op?: string;
  path?: string;
  value?: unknown;
}

function scimMeta(resourceType: string, created: Date, updated: Date) {
  return {
    resourceType,
    created: created.toISOString(),
    lastModified: updated.toISOString(),
    location: undefined as string | undefined,
  };
}

function emailsOf(payload: ScimUserPayload, fallback: string): string[] {
  const listed = (payload.emails ?? [])
    .map(item => item.value?.trim().toLowerCase())
    .filter((item): item is string => Boolean(item));
  if (listed.length > 0) {
    return listed;
  }
  return [fallback];
}

function displayNameOf(payload: ScimUserPayload, email: string): string {
  return (
    payload.displayName?.trim() ||
    payload.name?.formatted?.trim() ||
    [payload.name?.givenName, payload.name?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    payload.userName?.trim() ||
    email.split('@')[0] ||
    'user'
  );
}

export class ScimService {
  constructor(
    private readonly store: MosaicStore,
    private readonly identity: IdentityStore,
    private readonly clock: Clock,
    private readonly orgs: OrgService,
    private readonly auth: AuthService,
    private readonly audit?: AuditService
  ) {}

  async authenticate(bearer: string | undefined): Promise<Organization> {
    if (!bearer) {
      throw errors.scimUnauthorized();
    }
    const token = await this.store.findScimTokenByHash(sha256(bearer));
    if (!token) {
      throw errors.scimUnauthorized();
    }
    const org = await this.store.getOrganization(token.orgId);
    if (!org) {
      throw errors.scimUnauthorized();
    }
    await this.store.touchScimToken(token.id, this.clock.now());
    return org;
  }

  async createToken(user: User, name: string): Promise<{ id: string; token: string }> {
    const org = await this.orgs.requireOrgAdmin(user);
    const raw = randomToken(32);
    const now = this.clock.now();
    const record = await this.store.createScimToken({
      id: crypto.randomUUID(),
      orgId: org.id,
      name: name.trim() || 'SCIM',
      tokenHash: sha256(raw),
      createdAt: now,
      lastUsedAt: null,
    });
    return { id: record.id, token: raw };
  }

  async listTokens(user: User) {
    const org = await this.orgs.requireOrgAdmin(user);
    const tokens = await this.store.listScimTokens(org.id);
    return tokens.map(token => ({
      id: token.id,
      name: token.name,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
    }));
  }

  async revokeToken(user: User, id: string): Promise<boolean> {
    await this.orgs.requireOrgAdmin(user);
    return this.store.deleteScimToken(id);
  }

  serviceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth Bearer Token Standard',
          specUri: 'http://www.rfc-editor.org/info/rfc6750',
          primary: true,
        },
      ],
    };
  }

  resourceTypes() {
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 2,
      startIndex: 1,
      itemsPerPage: 2,
      Resources: [
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'User',
          name: 'User',
          endpoint: '/scim/v2/Users',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        },
        {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'Group',
          name: 'Group',
          endpoint: '/scim/v2/Groups',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        },
      ],
    };
  }

  async listUsers(
    org: Organization,
    query: { startIndex?: number; count?: number; filter?: string }
  ) {
    const startIndex = Math.max(1, query.startIndex ?? 1);
    const count = Math.min(200, Math.max(1, query.count ?? 100));
    const [items, total] = await Promise.all([
      this.store.listScimUsers(org.id, {
        startIndex,
        count,
        filter: query.filter ?? null,
      }),
      this.store.countScimUsers(org.id, query.filter ?? null),
    ]);
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex,
      itemsPerPage: items.length,
      Resources: items.map(item => this.toScimUser(item)),
    };
  }

  async getUser(org: Organization, id: string) {
    const user = await this.store.getScimUser(id);
    if (!user || user.orgId !== org.id) {
      throw errors.userNotFound();
    }
    return this.toScimUser(user);
  }

  async createUser(org: Organization, payload: ScimUserPayload) {
    const email = normalizeEmail(
      payload.emails?.find(item => item.primary)?.value ??
        payload.emails?.[0]?.value ??
        payload.userName ??
        ''
    );
    if (!email.includes('@')) {
      throw errors.invalidEmail();
    }
    const now = this.clock.now();
    let user = await this.identity.findUserByEmail(email);
    const active = payload.active !== false;
    if (!user) {
      user = await this.identity.createUser(
        {
          id: crypto.randomUUID(),
          email,
          name: displayNameOf(payload, email),
          emailVerified: true,
          avatarUrl: null,
          features: [],
          disabled: !active,
          createdAt: now,
          updatedAt: now,
        },
        null
      );
    } else if (!active && !user.disabled) {
      user = await this.identity.updateUser(user.id, { disabled: true });
    }
    await this.orgs.addMember(org.id, user.id, 'member');
    const scim = await this.store.createScimUser({
      id: crypto.randomUUID(),
      orgId: org.id,
      userId: user.id,
      externalId: payload.externalId ?? payload.userName ?? email,
      userName: payload.userName ?? email,
      displayName: displayNameOf(payload, email),
      active,
      emails: emailsOf(payload, email),
      createdAt: now,
      updatedAt: now,
    });
    await this.audit?.record({
      actorType: 'system',
      action: 'scim.user.create',
      targetType: 'user',
      targetId: user.id,
      metadata: { email, scimId: scim.id },
    });
    return this.toScimUser(scim);
  }

  async replaceUser(org: Organization, id: string, payload: ScimUserPayload) {
    const current = await this.requireUser(org, id);
    return this.applyUserPatch(current, payload, payload.active !== false);
  }

  async patchUser(
    org: Organization,
    id: string,
    operations: ScimPatchOp[]
  ) {
    const current = await this.requireUser(org, id);
    let active = current.active;
    const payload: ScimUserPayload = {
      userName: current.userName,
      displayName: current.displayName,
      externalId: current.externalId,
      emails: current.emails.map(value => ({ value })),
    };
    for (const op of operations) {
      const name = (op.op ?? 'replace').toLowerCase();
      if (name === 'replace' && (op.path === 'active' || op.path === 'User.active')) {
        active = Boolean(op.value);
      } else if (name === 'replace' && !op.path && op.value && typeof op.value === 'object') {
        Object.assign(payload, op.value);
        if ('active' in (op.value as ScimUserPayload)) {
          active = (op.value as ScimUserPayload).active !== false;
        }
      } else if (name === 'replace' && op.path === 'userName') {
        payload.userName = String(op.value ?? '');
      } else if (name === 'replace' && op.path === 'displayName') {
        payload.displayName = String(op.value ?? '');
      }
    }
    return this.applyUserPatch(current, payload, active);
  }

  async deleteUser(org: Organization, id: string): Promise<void> {
    const current = await this.requireUser(org, id);
    if (current.userId) {
      await this.identity.updateUser(current.userId, { disabled: true });
      await this.auth.revokeAllSessionsForUser(current.userId);
    }
    await this.store.updateScimUser(current.id, { active: false });
    await this.audit?.record({
      actorType: 'system',
      action: 'scim.user.disable',
      targetType: 'user',
      targetId: current.userId,
      metadata: { scimId: current.id },
    });
  }

  async listGroups(
    org: Organization,
    query: { startIndex?: number; count?: number; filter?: string }
  ) {
    const startIndex = Math.max(1, query.startIndex ?? 1);
    const count = Math.min(200, Math.max(1, query.count ?? 100));
    const [items, total] = await Promise.all([
      this.store.listScimGroups(org.id, {
        startIndex,
        count,
        filter: query.filter ?? null,
      }),
      this.store.countScimGroups(org.id, query.filter ?? null),
    ]);
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex,
      itemsPerPage: items.length,
      Resources: items.map(item => this.toScimGroup(item)),
    };
  }

  async getGroup(org: Organization, id: string) {
    const group = await this.store.getScimGroup(id);
    if (!group || group.orgId !== org.id) {
      throw errors.userNotFound();
    }
    return this.toScimGroup(group);
  }

  async createGroup(org: Organization, payload: ScimGroupPayload) {
    const now = this.clock.now();
    const group = await this.store.createScimGroup({
      id: crypto.randomUUID(),
      orgId: org.id,
      externalId: payload.externalId ?? payload.displayName ?? crypto.randomUUID(),
      displayName: payload.displayName?.trim() || 'Group',
      members: (payload.members ?? [])
        .map(item => item.value)
        .filter((item): item is string => Boolean(item)),
      createdAt: now,
      updatedAt: now,
    });
    await this.audit?.record({
      actorType: 'system',
      action: 'scim.group.create',
      targetType: 'group',
      targetId: group.id,
    });
    return this.toScimGroup(group);
  }

  async replaceGroup(org: Organization, id: string, payload: ScimGroupPayload) {
    const current = await this.requireGroup(org, id);
    const next = await this.store.updateScimGroup(current.id, {
      displayName: payload.displayName ?? current.displayName,
      externalId: payload.externalId ?? current.externalId,
      members: (payload.members ?? [])
        .map(item => item.value)
        .filter((item): item is string => Boolean(item)),
    });
    await this.audit?.record({
      actorType: 'system',
      action: 'scim.group.update',
      targetType: 'group',
      targetId: next.id,
    });
    return this.toScimGroup(next);
  }

  async patchGroup(org: Organization, id: string, operations: ScimPatchOp[]) {
    const current = await this.requireGroup(org, id);
    let members = [...current.members];
    let displayName = current.displayName;
    for (const op of operations) {
      const name = (op.op ?? 'replace').toLowerCase();
      if (name === 'replace' && op.path === 'displayName') {
        displayName = String(op.value ?? displayName);
      } else if (name === 'replace' && (op.path === 'members' || !op.path)) {
        if (Array.isArray(op.value)) {
          members = (op.value as ScimMemberRef[])
            .map(item => item.value)
            .filter((item): item is string => Boolean(item));
        }
      } else if (name === 'add' && op.path === 'members' && Array.isArray(op.value)) {
        for (const item of op.value as ScimMemberRef[]) {
          if (item.value && !members.includes(item.value)) {
            members.push(item.value);
          }
        }
      } else if (name === 'remove' && op.path?.startsWith('members')) {
        const match = /members\[value eq "([^"]+)"\]/i.exec(op.path);
        if (match?.[1]) {
          members = members.filter(item => item !== match[1]);
        }
      }
    }
    return this.toScimGroup(
      await this.store.updateScimGroup(current.id, { displayName, members })
    );
  }

  async deleteGroup(org: Organization, id: string): Promise<void> {
    const current = await this.requireGroup(org, id);
    await this.store.deleteScimGroup(current.id);
    await this.audit?.record({
      actorType: 'system',
      action: 'scim.group.delete',
      targetType: 'group',
      targetId: current.id,
    });
  }

  private async requireUser(org: Organization, id: string): Promise<ScimUser> {
    const user = await this.store.getScimUser(id);
    if (!user || user.orgId !== org.id) {
      throw errors.userNotFound();
    }
    return user;
  }

  private async requireGroup(org: Organization, id: string): Promise<ScimGroup> {
    const group = await this.store.getScimGroup(id);
    if (!group || group.orgId !== org.id) {
      throw errors.userNotFound();
    }
    return group;
  }

  private async applyUserPatch(
    current: ScimUser,
    payload: ScimUserPayload,
    active: boolean
  ) {
    const email = normalizeEmail(
      payload.emails?.find(item => item.primary)?.value ??
        payload.emails?.[0]?.value ??
        current.emails[0] ??
        current.userName
    );
    if (current.userId) {
      const patch: Parameters<IdentityStore['updateUser']>[1] = {
        disabled: !active,
        name: displayNameOf(payload, email),
      };
      if (email && email.includes('@')) {
        patch.email = email;
      }
      await this.identity.updateUser(current.userId, patch);
      if (!active) {
        await this.auth.revokeAllSessionsForUser(current.userId);
      }
    }
    const updated = await this.store.updateScimUser(current.id, {
      active,
      userName: payload.userName ?? current.userName,
      displayName: displayNameOf(payload, email),
      externalId: payload.externalId ?? current.externalId,
      emails: emailsOf(payload, email),
    });
    await this.audit?.record({
      actorType: 'system',
      action: active ? 'scim.user.update' : 'scim.user.disable',
      targetType: 'user',
      targetId: current.userId,
      metadata: { scimId: current.id, active },
    });
    return this.toScimUser(updated);
  }

  private toScimUser(user: ScimUser) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.externalId,
      userName: user.userName,
      displayName: user.displayName,
      active: user.active,
      emails: user.emails.map((value, index) => ({
        value,
        primary: index === 0,
        type: 'work',
      })),
      meta: scimMeta('User', user.createdAt, user.updatedAt),
    };
  }

  private toScimGroup(group: ScimGroup) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: group.id,
      externalId: group.externalId,
      displayName: group.displayName,
      members: group.members.map(value => ({ value, type: 'User' })),
      meta: scimMeta('Group', group.createdAt, group.updatedAt),
    };
  }
}
