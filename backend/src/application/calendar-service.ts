import type { AuditService } from './audit-service.js';
import type { WorkspaceService } from './workspace-service.js';
import {
  CALDAV_PRESETS,
  type CalendarAccount,
  type CalendarEvent,
  type CalendarProvider,
  type CalendarSubscription,
  type WorkspaceCalendar,
  type WorkspaceCalendarItem,
} from '../domain/calendar.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { CalendarStore, Clock } from '../domain/ports.js';

function cipherSecret(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

export class CalendarService {
  constructor(
    private readonly store: CalendarStore,
    private readonly workspaces: WorkspaceService,
    private readonly clock: Clock,
    private readonly publicUrl: string,
    private readonly audit?: AuditService
  ) {}

  providers(): CalendarProvider[] {
    return ['Google', 'CalDAV'];
  }

  caldavPresets() {
    return CALDAV_PRESETS;
  }

  async linkGoogle(
    user: User,
    input: { redirectUri?: string | null }
  ): Promise<string> {
    const state = crypto.randomUUID();
    const redirect = encodeURIComponent(
      input.redirectUri ?? `${this.publicUrl}/calendar/oauth/callback`
    );
    const url = `${this.publicUrl.replace(/\/$/, '')}/api/calendar/oauth/google/callback?state=${state}&redirect_uri=${redirect}`;
    await this.completeGoogle(user, state);
    return url;
  }

  async completeGoogle(user: User, state: string): Promise<CalendarAccount> {
    const now = this.clock.now();
    const account = await this.store.createCalendarAccount({
      id: crypto.randomUUID(),
      userId: user.id,
      provider: 'Google',
      providerAccountId: `google:${user.id}:${state.slice(0, 8)}`,
      displayName: user.name,
      email: user.email,
      status: 'connected',
      lastError: null,
      refreshIntervalMinutes: 15,
      tokenCipher: cipherSecret(`google-stub:${state}`),
      createdAt: now,
      updatedAt: now,
    });
    const sub = await this.store.createCalendarSubscription({
      id: crypto.randomUUID(),
      accountId: account.id,
      provider: 'Google',
      externalCalendarId: 'primary',
      displayName: 'Primary',
      timezone: 'UTC',
      color: '#4285F4',
      enabled: true,
      lastSyncAt: now,
    });
    await this.seedEvent(sub.id, 'Google hold', now);
    await this.audit?.record({
      actorId: user.id,
      action: 'calendar.account_link',
      targetType: 'calendar_account',
      targetId: account.id,
      metadata: { provider: 'Google' },
    });
    return account;
  }

  async linkCalDav(
    user: User,
    input: {
      providerPresetId: string;
      username: string;
      password: string;
      displayName?: string | null;
    }
  ): Promise<CalendarAccount> {
    const preset = CALDAV_PRESETS.find(
      item => item.id === input.providerPresetId
    );
    if (!preset) {
      throw errors.badRequest('Unknown CalDAV provider preset.');
    }
    const now = this.clock.now();
    const account = await this.store.createCalendarAccount({
      id: crypto.randomUUID(),
      userId: user.id,
      provider: 'CalDAV',
      providerAccountId: `${preset.id}:${input.username}`,
      displayName: input.displayName ?? preset.label,
      email: input.username,
      status: 'connected',
      lastError: null,
      refreshIntervalMinutes: 15,
      tokenCipher: cipherSecret(input.password),
      createdAt: now,
      updatedAt: now,
    });
    const sub = await this.store.createCalendarSubscription({
      id: crypto.randomUUID(),
      accountId: account.id,
      provider: 'CalDAV',
      externalCalendarId: 'default',
      displayName: preset.label,
      timezone: 'UTC',
      color: '#0F9D58',
      enabled: true,
      lastSyncAt: now,
    });
    await this.seedEvent(sub.id, `${preset.label} event`, now);
    await this.audit?.record({
      actorId: user.id,
      action: 'calendar.account_link',
      targetType: 'calendar_account',
      targetId: account.id,
      metadata: { provider: 'CalDAV', preset: preset.id },
    });
    return account;
  }

  async unlink(user: User, accountId: string): Promise<boolean> {
    const account = await this.store.getCalendarAccount(accountId);
    if (!account || account.userId !== user.id) {
      throw errors.calendarAccountNotFound();
    }
    return this.store.deleteCalendarAccount(accountId);
  }

  async updateAccount(
    user: User,
    accountId: string,
    refreshIntervalMinutes: number
  ): Promise<CalendarAccount> {
    const account = await this.store.getCalendarAccount(accountId);
    if (!account || account.userId !== user.id) {
      throw errors.calendarAccountNotFound();
    }
    return this.store.updateCalendarAccount(accountId, {
      refreshIntervalMinutes: Math.min(1440, Math.max(5, refreshIntervalMinutes)),
      updatedAt: this.clock.now(),
    });
  }

  async listAccounts(user: User): Promise<CalendarAccount[]> {
    return this.store.listCalendarAccounts(user.id);
  }

  async listSubscriptions(
    accountId: string
  ): Promise<CalendarSubscription[]> {
    return this.store.listCalendarSubscriptions(accountId);
  }

  async workspaceCalendars(
    user: User,
    workspaceId: string
  ): Promise<WorkspaceCalendar[]> {
    await this.workspaces.requireMember(user, workspaceId);
    const row = await this.store.getWorkspaceCalendar(workspaceId);
    return row ? [row] : [];
  }

  async updateWorkspaceCalendars(
    user: User,
    input: {
      workspaceId: string;
      items: Array<{
        subscriptionId: string;
        sortOrder?: number | null;
        colorOverride?: string | null;
      }>;
    }
  ): Promise<WorkspaceCalendar> {
    await this.workspaces.requireAdmin(user, input.workspaceId);
    const existing = await this.store.getWorkspaceCalendar(input.workspaceId);
    const calendar = await this.store.upsertWorkspaceCalendar(
      existing ?? {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        createdByUserId: user.id,
        displayNameOverride: null,
        colorOverride: null,
        enabled: true,
      }
    );
    await this.store.replaceWorkspaceCalendarItems(
      calendar.id,
      input.items.map((item, index) => ({
        id: crypto.randomUUID(),
        workspaceCalendarId: calendar.id,
        subscriptionId: item.subscriptionId,
        sortOrder: item.sortOrder ?? index,
        colorOverride: item.colorOverride ?? null,
        enabled: true,
      }))
    );
    return calendar;
  }

  async listItems(
    workspaceCalendarId: string
  ): Promise<WorkspaceCalendarItem[]> {
    return this.store.listWorkspaceCalendarItems(workspaceCalendarId);
  }

  async events(
    subscriptionId: string,
    from: Date,
    to: Date
  ): Promise<CalendarEvent[]> {
    return this.store.listCalendarEvents(subscriptionId, from, to);
  }

  async handleSyncJob(payload: Record<string, unknown>): Promise<void> {
    const accountId =
      typeof payload.accountId === 'string' ? payload.accountId : null;
    if (!accountId) {
      return;
    }
    const account = await this.store.getCalendarAccount(accountId);
    if (!account) {
      return;
    }
    await this.store.updateCalendarAccount(accountId, {
      updatedAt: this.clock.now(),
    });
  }

  private async seedEvent(
    subscriptionId: string,
    title: string,
    now: Date
  ): Promise<void> {
    await this.store.upsertCalendarEvent({
      id: crypto.randomUUID(),
      subscriptionId,
      externalEventId: `seed-${subscriptionId.slice(0, 8)}`,
      recurrenceId: null,
      status: 'confirmed',
      title,
      description: 'Seeded by Mosaic Calendar (no live provider sync).',
      location: null,
      startAtUtc: now,
      endAtUtc: new Date(now.getTime() + 60 * 60 * 1000),
      originalTimezone: 'UTC',
      allDay: false,
    });
  }
}
