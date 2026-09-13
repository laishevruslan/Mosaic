import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { errors } from '../domain/errors.js';

export class CaptchaService {
  constructor(
    private readonly secret: string,
    private readonly enabled: boolean,
    private readonly ttlMs = 10 * 60 * 1000
  ) {}

  get advertised(): boolean {
    return this.enabled;
  }

  issue(): { challenge: string; token: string } {
    if (!this.enabled) {
      throw errors.actionForbidden('Captcha is not enabled.');
    }
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + this.ttlMs;
    const payload = `${nonce}.${exp}`;
    return {
      challenge: nonce,
      token: `${payload}.${this.sign(payload)}`,
    };
  }

  verify(token: string | undefined): void {
    if (!this.enabled) {
      return;
    }
    if (!token) {
      throw errors.badRequest('Captcha is required.');
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw errors.badRequest('Captcha challenge failed.');
    }
    const [nonce, expRaw, sig] = parts;
    const payload = `${nonce}.${expRaw}`;
    const expected = this.sign(payload);
    const left = Buffer.from(sig ?? '', 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw errors.badRequest('Captcha challenge failed.');
    }
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || Date.now() > exp) {
      throw errors.badRequest('Captcha challenge expired.');
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }
}
