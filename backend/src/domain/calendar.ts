export type CalendarProvider = 'Google' | 'CalDAV';

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: CalendarProvider;
  providerAccountId: string;
  displayName: string | null;
  email: string | null;
  status: string;
  lastError: string | null;
  refreshIntervalMinutes: number;
  tokenCipher: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarSubscription {
  id: string;
  accountId: string;
  provider: CalendarProvider;
  externalCalendarId: string;
  displayName: string | null;
  timezone: string | null;
  color: string | null;
  enabled: boolean;
  lastSyncAt: Date | null;
}

export interface CalendarEvent {
  id: string;
  subscriptionId: string;
  externalEventId: string;
  recurrenceId: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  startAtUtc: Date;
  endAtUtc: Date;
  originalTimezone: string | null;
  allDay: boolean;
}

export interface WorkspaceCalendar {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  displayNameOverride: string | null;
  colorOverride: string | null;
  enabled: boolean;
}

export interface WorkspaceCalendarItem {
  id: string;
  workspaceCalendarId: string;
  subscriptionId: string;
  sortOrder: number | null;
  colorOverride: string | null;
  enabled: boolean;
}

export interface CalDavPreset {
  id: string;
  label: string;
  requiresAppPassword: boolean;
  docsUrl: string | null;
}

export const CALDAV_PRESETS: CalDavPreset[] = [
  {
    id: 'fastmail',
    label: 'Fastmail',
    requiresAppPassword: true,
    docsUrl:
      'https://www.fastmail.help/hc/en-us/articles/1500000278342-Calendar-with-CalDAV',
  },
  {
    id: 'nextcloud',
    label: 'Nextcloud',
    requiresAppPassword: true,
    docsUrl:
      'https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html',
  },
  {
    id: 'generic',
    label: 'CalDAV',
    requiresAppPassword: false,
    docsUrl: null,
  },
];
