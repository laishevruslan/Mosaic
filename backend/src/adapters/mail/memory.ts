import type { MailMessage } from '../../domain/notify.js';
import type { MailPort } from '../../domain/ports.js';

export class MemoryMailer implements MailPort {
  readonly configured = true;
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push({ ...message });
  }
}

export class NullMailer implements MailPort {
  readonly configured = false;

  async send(): Promise<void> {
    throw new Error('SMTP is not configured.');
  }
}
