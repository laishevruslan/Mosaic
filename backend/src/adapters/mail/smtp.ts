import nodemailer from 'nodemailer';

import type { MailMessage } from '../../domain/notify.js';
import type { MailPort } from '../../domain/ports.js';
import { MemoryMailer, NullMailer } from './memory.js';

export interface SmtpMailerOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  secure: boolean;
  ignoreTls: boolean;
}

export class SmtpMailer implements MailPort {
  readonly configured = true;
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(opts: SmtpMailerOptions) {
    this.from = opts.from;
    const auth =
      opts.user && opts.password
        ? { user: opts.user, pass: opts.password }
        : undefined;
    this.transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      ignoreTLS: opts.ignoreTls,
      ...(auth ? { auth } : {}),
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export function createMailer(input: {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  from?: string;
  secure: boolean;
  ignoreTls: boolean;
  nodeEnv: string;
}): MailPort {
  if (input.nodeEnv === 'test') {
    return new MemoryMailer();
  }
  const host = input.host?.trim();
  if (!host) {
    return new NullMailer();
  }
  const from = input.from?.trim() || 'Mosaic <noreply@localhost>';
  const options: SmtpMailerOptions = {
    host,
    port: input.port,
    from,
    secure: input.secure,
    ignoreTls: input.ignoreTls,
  };
  if (input.user) {
    options.user = input.user;
  }
  if (input.password) {
    options.password = input.password;
  }
  return new SmtpMailer(options);
}
