import type { DailyAnalytics } from '../domain/search.js';
import type {
  AnalyticsStore,
  BlobStore,
  Clock,
  DocStore,
  MosaicStore,
  ShareStore,
  WorkspaceStore,
} from '../domain/ports.js';

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function windowOf(
  now: Date,
  size: number,
  unit: 'Day' | 'Hour' | 'Minute',
  timezone = 'UTC'
) {
  const ms =
    unit === 'Day'
      ? size * 24 * 60 * 60 * 1000
      : unit === 'Hour'
        ? size * 60 * 60 * 1000
        : size * 60 * 1000;
  return {
    from: new Date(now.getTime() - ms),
    to: now,
    timezone,
    bucket: unit,
    requestedSize: size,
    effectiveSize: size,
  };
}

export class AnalyticsService {
  constructor(
    private readonly analytics: AnalyticsStore,
    private readonly store: MosaicStore,
    private readonly workspaces: WorkspaceStore,
    private readonly blobs: BlobStore,
    private readonly docs: DocStore,
    private readonly shares: ShareStore,
    private readonly clock: Clock,
    private readonly publicUrl: string
  ) {}

  async recordShareView(input: {
    workspaceId: string;
    docId: string;
    visitorKey: string;
    guest: boolean;
  }): Promise<void> {
    await this.analytics.recordShareView({
      ...input,
      at: this.clock.now(),
    });
  }

  async dashboard(input?: {
    copilotWindowDays?: number | null;
    sharedLinkWindowDays?: number | null;
    storageHistoryDays?: number | null;
    syncHistoryHours?: number | null;
    timezone?: string | null;
  }) {
    const now = this.clock.now();
    const timezone = input?.timezone ?? 'UTC';
    const copilotDays = input?.copilotWindowDays ?? 7;
    const shareDays = input?.sharedLinkWindowDays ?? 28;
    const storageDays = input?.storageHistoryDays ?? 30;
    const syncHours = input?.syncHistoryHours ?? 48;

    const rollup = await this.computeRollup(now);
    await this.analytics.upsertDailyAnalytics(rollup);

    const history = await this.analytics.listDailyAnalytics(
      isoDay(daysAgo(now, storageDays)),
      isoDay(now)
    );
    const copilotConversations = await this.countCopilotSince(
      daysAgo(now, copilotDays)
    );

    return {
      syncActiveUsers: 0,
      syncActiveUsersTimeline: [] as Array<{ minute: Date; activeUsers: number }>,
      syncWindow: windowOf(now, syncHours, 'Hour', timezone),
      copilotConversations,
      copilotWindow: windowOf(now, copilotDays, 'Day', timezone),
      workspaceStorageBytes: rollup.workspaceStorageBytes,
      blobStorageBytes: rollup.blobStorageBytes,
      workspaceStorageHistory: history.map(row => ({
        date: new Date(`${row.day}T00:00:00.000Z`),
        value: row.workspaceStorageBytes,
      })),
      blobStorageHistory: history.map(row => ({
        date: new Date(`${row.day}T00:00:00.000Z`),
        value: row.blobStorageBytes,
      })),
      storageWindow: windowOf(now, storageDays, 'Day', timezone),
      topSharedLinks: await this.topSharedLinks(),
      topSharedLinksWindow: windowOf(now, shareDays, 'Day', timezone),
      generatedAt: now,
    };
  }

  private async computeRollup(now: Date): Promise<DailyAnalytics> {
    const ids = await this.workspaces.listWorkspaceIds();
    let blobStorageBytes = 0;
    let workspaceStorageBytes = 0;
    for (const workspaceId of ids) {
      blobStorageBytes += await this.blobs.usedStorage(workspaceId);
      const timestamps = await this.docs.listTimestamps(
        'workspace',
        workspaceId
      );
      for (const docId of Object.keys(timestamps)) {
        const record = await this.docs.getDocument(
          'workspace',
          workspaceId,
          docId
        );
        workspaceStorageBytes += record?.snapshot?.byteLength ?? 0;
      }
    }
    workspaceStorageBytes += blobStorageBytes;
    return {
      day: isoDay(now),
      workspaceStorageBytes,
      blobStorageBytes,
      copilotConversations: await this.countCopilotSince(daysAgo(now, 1)),
      syncActiveUsers: 0,
    };
  }

  private async countCopilotSince(from: Date): Promise<number> {
    const workspaceIds = await this.workspaces.listWorkspaceIds();
    let count = 0;
    for (let skip = 0; ; skip += 100) {
      const users = await this.store.listUsers({ skip, take: 100 });
      if (users.length === 0) {
        break;
      }
      for (const user of users) {
        for (const workspaceId of workspaceIds) {
          const sessions = await this.store.listCopilotSessions(
            user.id,
            workspaceId
          );
          count += sessions.filter(session => session.createdAt >= from).length;
        }
      }
      if (users.length < 100) {
        break;
      }
    }
    return count;
  }

  private async topSharedLinks() {
    const stats = await this.analytics.listShareStats();
    const ranked = [...stats].sort((a, b) => b.views - a.views).slice(0, 20);
    const items = [];
    for (const row of ranked) {
      const doc = await this.shares.getPublicDoc(row.workspaceId, row.docId);
      items.push({
        workspaceId: row.workspaceId,
        docId: row.docId,
        title: row.docId,
        shareUrl: `${this.publicUrl}/workspace/${row.workspaceId}/${row.docId}`,
        publishedAt: doc?.publishedAt ?? null,
        views: row.views,
        uniqueViews: row.uniqueViews,
        guestViews: row.guestViews,
        lastAccessedAt: row.lastAccessedAt,
      });
    }
    return items;
  }
}
