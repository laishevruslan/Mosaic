import { errors } from '../domain/errors.js';
import type { User, UserFeature, UserListFilter } from '../domain/identity.js';
import type {
  Clock,
  IdentityStore,
  PasswordHasher,
} from '../domain/ports.js';
import { displayNameFromEmail, isValidEmail, normalizeEmail } from './crypto.js';
import type { AuditService } from './audit-service.js';
import type { AuthService } from './auth-service.js';

export class AdminUserService {
  constructor(
    private readonly identity: IdentityStore,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly auth: AuthService,
    private readonly extras: {
      passwordMin: number;
      passwordMax: number;
      audit?: AuditService;
    }
  ) {}

  async list(filter: UserListFilter) {
    const [users, count] = await Promise.all([
      this.identity.listUsers(filter),
      this.identity.countUsersFiltered({
        ...(filter.keyword ? { keyword: filter.keyword } : {}),
        ...(filter.features ? { features: filter.features } : {}),
      }),
    ]);
    return { users, count };
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.identity.findUserByEmail(normalizeEmail(email));
  }

  async create(input: {
    email: string;
    name?: string | null;
    password?: string | null;
  }): Promise<User> {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) {
      throw errors.invalidEmail();
    }
    if (input.password) {
      this.assertPassword(input.password);
    }
    const now = this.clock.now();
    const hash = input.password
      ? await this.hasher.hash(input.password)
      : null;
    const user = await this.identity.createUser(
      {
        id: crypto.randomUUID(),
        email,
        name: input.name?.trim() || displayNameFromEmail(email),
        emailVerified: true,
        avatarUrl: null,
        features: [],
        disabled: false,
        createdAt: now,
        updatedAt: now,
      },
      hash
    );
    await this.extras.audit?.record({
      action: 'admin.user.create',
      targetType: 'user',
      targetId: user.id,
      metadata: { email },
    });
    return user;
  }

  async importUsers(
    rows: Array<{ email: string; name?: string | null; password?: string | null }>
  ): Promise<Array<User | { email: string; error: string }>> {
    const results: Array<User | { email: string; error: string }> = [];
    for (const row of rows) {
      try {
        results.push(await this.create(row));
      } catch (error) {
        results.push({
          email: row.email,
          error: error instanceof Error ? error.message : 'import_failed',
        });
      }
    }
    return results;
  }

  async update(
    id: string,
    input: { name?: string | null; email?: string | null }
  ): Promise<User> {
    const patch: Parameters<IdentityStore['updateUser']>[1] = {};
    if (input.name != null) {
      patch.name = input.name.trim();
    }
    if (input.email != null) {
      const email = normalizeEmail(input.email);
      if (!isValidEmail(email)) {
        throw errors.invalidEmail();
      }
      patch.email = email;
    }
    return this.identity.updateUser(id, patch);
  }

  async updateFeatures(id: string, features: UserFeature[]): Promise<UserFeature[]> {
    const unique = [...new Set(features.filter(item => item === 'Admin'))];
    const user = await this.identity.updateUser(id, { features: unique });
    return user.features;
  }

  async setDisabled(actor: User, id: string, disabled: boolean): Promise<User> {
    if (actor.id === id && disabled) {
      throw errors.actionForbidden('You cannot disable your own account.');
    }
    const user = await this.identity.updateUser(id, { disabled });
    if (disabled) {
      await this.auth.revokeAllSessionsForUser(id);
    }
    await this.extras.audit?.record({
      actorId: actor.id,
      action: disabled ? 'admin.user.disable' : 'admin.user.enable',
      targetType: 'user',
      targetId: id,
    });
    return user;
  }

  async delete(actor: User, id: string): Promise<boolean> {
    if (actor.id === id) {
      throw errors.actionForbidden('You cannot delete your own account.');
    }
    await this.auth.revokeAllSessionsForUser(id);
    const ok = await this.identity.deleteUser(id);
    if (ok) {
      await this.extras.audit?.record({
        actorId: actor.id,
        action: 'admin.user.delete',
        targetType: 'user',
        targetId: id,
      });
    }
    return ok;
  }

  async changePasswordUrl(userId: string, callbackUrl: string): Promise<string> {
    const user = await this.identity.findUserById(userId);
    if (!user) {
      throw errors.userNotFound();
    }
    const url = new URL(callbackUrl);
    url.searchParams.set('user_id', user.id);
    return url.toString();
  }

  async hasPassword(user: User): Promise<boolean> {
    return (await this.identity.getCredential(user.id)) !== null;
  }

  private assertPassword(password: string): void {
    if (
      password.length < this.extras.passwordMin ||
      password.length > this.extras.passwordMax
    ) {
      throw errors.invalidPasswordLength(
        this.extras.passwordMin,
        this.extras.passwordMax
      );
    }
  }
}
