export const NOTIFICATION_TYPES = [
  'Mention',
  'Comment',
  'CommentMention',
  'Invitation',
  'InvitationAccepted',
  'InvitationBlocked',
  'InvitationRejected',
  'InvitationReviewApproved',
  'InvitationReviewDeclined',
  'InvitationReviewRequest',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_LEVELS = [
  'Default',
  'High',
  'Low',
  'Min',
  'None',
] as const;

export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  level: NotificationLevel;
  read: boolean;
  body: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPrefs {
  userId: string;
  receiveInvitationEmail: boolean;
  receiveMentionEmail: boolean;
  receiveCommentEmail: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPrefs, 'userId'> = {
  receiveInvitationEmail: true,
  receiveMentionEmail: true,
  receiveCommentEmail: true,
};

export type OutboxEmailStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface OutboxEmail {
  id: string;
  toEmail: string;
  subject: string;
  text: string;
  html: string;
  template: string;
  payload: Record<string, unknown>;
  status: OutboxEmailStatus;
  attempts: number;
  lastError: string | null;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
