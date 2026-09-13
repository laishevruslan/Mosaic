import { encodeCursor, type Pagination } from '../domain/comment.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationLevel,
  type NotificationPrefs,
  type NotificationRecord,
  type NotificationType,
} from '../domain/notify.js';
import type {
  Clock,
  IdentityStore,
  NotificationStore,
  RealtimeHub,
  WorkspaceStore,
} from '../domain/ports.js';

export interface NotificationPage {
  items: Array<NotificationRecord & { cursor: string }>;
  totalCount: number;
  startCursor: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class NotificationService {
  constructor(
    private readonly store: NotificationStore,
    private readonly identity: IdentityStore,
    private readonly workspaces: WorkspaceStore,
    private readonly clock: Clock,
    private readonly hub?: RealtimeHub
  ) {}

  async list(user: User, pagination?: Pagination): Promise<NotificationPage> {
    const page = await this.store.listNotifications(user.id, pagination);
    const items = page.items.map(item => ({
      ...item,
      cursor: encodeCursor(item.createdAt, item.id),
    }));
    return {
      items,
      totalCount: page.totalCount,
      startCursor: items[0]?.cursor ?? null,
      endCursor: items[items.length - 1]?.cursor ?? null,
      hasNextPage: page.hasNextPage,
      hasPreviousPage: Boolean(pagination?.after || pagination?.offset),
    };
  }

  async unreadCount(user: User): Promise<number> {
    return this.store.countUnreadNotifications(user.id);
  }

  async read(user: User, id: string): Promise<boolean> {
    const ok = await this.store.markNotificationRead(
      id,
      user.id,
      this.clock.now()
    );
    if (!ok) {
      throw errors.notificationNotFound();
    }
    await this.emitCount(user.id);
    return true;
  }

  async readAll(user: User): Promise<boolean> {
    await this.store.markAllNotificationsRead(user.id, this.clock.now());
    await this.emitCount(user.id);
    return true;
  }

  async prefs(user: User): Promise<NotificationPrefs> {
    const stored = await this.store.getNotificationPrefs(user.id);
    return stored ?? { userId: user.id, ...DEFAULT_NOTIFICATION_PREFS };
  }

  async updatePrefs(
    user: User,
    patch: Partial<Omit<NotificationPrefs, 'userId'>>
  ): Promise<boolean> {
    const current = await this.prefs(user);
    await this.store.upsertNotificationPrefs({
      userId: user.id,
      receiveInvitationEmail:
        patch.receiveInvitationEmail ?? current.receiveInvitationEmail,
      receiveMentionEmail:
        patch.receiveMentionEmail ?? current.receiveMentionEmail,
      receiveCommentEmail:
        patch.receiveCommentEmail ?? current.receiveCommentEmail,
    });
    return true;
  }

  async create(input: {
    userId: string;
    type: NotificationType;
    level?: NotificationLevel;
    body: Record<string, unknown>;
  }): Promise<NotificationRecord> {
    const now = this.clock.now();
    const saved = await this.store.createNotification({
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      level: input.level ?? 'Default',
      read: false,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    });
    await this.emitCount(input.userId);
    return saved;
  }

  async mention(
    actor: User,
    input: {
      userId: string;
      workspaceId: string;
      doc: {
        id: string;
        title: string;
        mode: 'page' | 'edgeless';
        blockId?: string | null;
        elementId?: string | null;
      };
    }
  ): Promise<string> {
    if (input.userId === actor.id) {
      throw errors.badRequest('You cannot mention yourself.');
    }
    const member = await this.workspaces.getMember(
      input.workspaceId,
      actor.id
    );
    if (!member) {
      throw errors.spaceAccessDenied(input.workspaceId);
    }
    const targetMember = await this.workspaces.getMember(
      input.workspaceId,
      input.userId
    );
    if (!targetMember) {
      throw errors.actionForbidden('Mentioned user is not in this workspace.');
    }
    const workspace = await this.workspaces.getWorkspace(input.workspaceId);
    if (!workspace) {
      throw errors.spaceNotFound();
    }
    const mentioned = await this.identity.findUserById(input.userId);
    if (!mentioned) {
      throw errors.userNotFound();
    }
    const created = await this.create({
      userId: mentioned.id,
      type: 'Mention',
      body: {
        type: 'Mention',
        createdByUser: {
          id: actor.id,
          name: actor.name,
          avatarUrl: actor.avatarUrl,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          avatarUrl: null,
        },
        doc: {
          id: input.doc.id,
          title: input.doc.title,
          mode: input.doc.mode,
          blockId: input.doc.blockId ?? null,
          elementId: input.doc.elementId ?? null,
        },
      },
    });
    return created.id;
  }

  async invite(
    actor: User,
    input: {
      userId?: string | null;
      email: string;
      workspaceId: string;
      inviteId: string;
    }
  ): Promise<void> {
    if (!input.userId) {
      return;
    }
    const workspace = await this.workspaces.getWorkspace(input.workspaceId);
    if (!workspace) {
      return;
    }
    await this.create({
      userId: input.userId,
      type: 'Invitation',
      body: {
        type: 'Invitation',
        inviteId: input.inviteId,
        createdByUser: {
          id: actor.id,
          name: actor.name,
          avatarUrl: actor.avatarUrl,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          avatarUrl: null,
        },
      },
    });
  }

  private async emitCount(userId: string): Promise<void> {
    if (!this.hub) {
      return;
    }
    const count = await this.store.countUnreadNotifications(userId);
    this.hub.emit('notification.count.changed', {}, { count });
  }
}
