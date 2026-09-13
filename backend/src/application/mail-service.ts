import type { JobWorker } from '../adapters/jobs/worker.js';
import { errors } from '../domain/errors.js';
import type { MailMessage, OutboxEmail } from '../domain/notify.js';
import type {
  Clock,
  MailOutboxStore,
  MailPort,
  NotificationStore,
} from '../domain/ports.js';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from '../domain/notify.js';

export class MailService {
  constructor(
    private readonly outbox: MailOutboxStore,
    private readonly prefs: NotificationStore,
    private readonly mailer: MailPort,
    private readonly clock: Clock,
    private readonly jobs: JobWorker,
    private readonly publicUrl: string
  ) {}

  get configured(): boolean {
    return this.mailer.configured;
  }

  async enqueueInvite(input: {
    toEmail: string;
    workspaceName: string;
    workspaceId: string;
    inviteId: string;
    inviterName: string;
    userId?: string | null;
  }): Promise<OutboxEmail | null> {
    if (input.userId) {
      const prefs = await this.userPrefs(input.userId);
      if (!prefs.receiveInvitationEmail) {
        return null;
      }
    }
    const link = `${this.publicUrl.replace(/\/$/, '')}/invite/${input.inviteId}`;
    const subject = `${input.inviterName} invited you to ${input.workspaceName} on Mosaic`;
    const text = `${input.inviterName} invited you to join "${input.workspaceName}".\n\nAccept: ${link}`;
    const html = `<p>${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.workspaceName)}</strong>.</p><p><a href="${escapeHtml(link)}">Accept invitation</a></p>`;
    return this.enqueue({
      to: input.toEmail,
      subject,
      text,
      html,
      template: 'invite',
      payload: {
        workspaceId: input.workspaceId,
        inviteId: input.inviteId,
      },
    });
  }

  async enqueueMention(input: {
    toEmail: string;
    userId: string;
    actorName: string;
    docTitle: string;
    workspaceName: string;
  }): Promise<OutboxEmail | null> {
    const prefs = await this.userPrefs(input.userId);
    if (!prefs.receiveMentionEmail) {
      return null;
    }
    const subject = `${input.actorName} mentioned you in ${input.docTitle}`;
    const text = `${input.actorName} mentioned you in "${input.docTitle}" (${input.workspaceName}).`;
    const html = `<p>${escapeHtml(input.actorName)} mentioned you in <strong>${escapeHtml(input.docTitle)}</strong> (${escapeHtml(input.workspaceName)}).</p>`;
    return this.enqueue({
      to: input.toEmail,
      subject,
      text,
      html,
      template: 'mention',
      payload: { userId: input.userId },
    });
  }

  async sendTest(message: MailMessage): Promise<void> {
    if (!this.mailer.configured) {
      throw errors.emailServiceNotConfigured();
    }
    await this.mailer.send(message);
  }

  async deliver(outboxId: string): Promise<void> {
    const row = await this.outbox.getOutbox(outboxId);
    if (!row || row.status === 'sent') {
      return;
    }
    if (!this.mailer.configured) {
      await this.outbox.updateOutbox(outboxId, {
        status: 'skipped',
        lastError: 'SMTP is not configured.',
        attempts: row.attempts + 1,
      });
      return;
    }
    try {
      await this.mailer.send({
        to: row.toEmail,
        subject: row.subject,
        text: row.text,
        html: row.html,
      });
      await this.outbox.updateOutbox(outboxId, {
        status: 'sent',
        attempts: row.attempts + 1,
        lastError: null,
        sentAt: this.clock.now(),
      });
    } catch (error) {
      await this.outbox.updateOutbox(outboxId, {
        status: 'failed',
        attempts: row.attempts + 1,
        lastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async enqueue(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    template: string;
    payload: Record<string, unknown>;
  }): Promise<OutboxEmail> {
    const now = this.clock.now();
    const row = await this.outbox.enqueueOutbox({
      id: crypto.randomUUID(),
      toEmail: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      template: input.template,
      payload: input.payload,
      status: 'pending',
      attempts: 0,
      lastError: null,
      scheduledAt: now,
      sentAt: null,
      createdAt: now,
    });
    await this.jobs.enqueue('mail.send', { outboxId: row.id });
    return row;
  }

  private async userPrefs(userId: string): Promise<NotificationPrefs> {
    const stored = await this.prefs.getNotificationPrefs(userId);
    return stored ?? { userId, ...DEFAULT_NOTIFICATION_PREFS };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
