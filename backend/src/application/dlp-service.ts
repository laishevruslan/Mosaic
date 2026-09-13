import type {
  ContentClassifier,
  DlpMode,
  DlpVerdict,
} from '../domain/dlp.js';
import { errors } from '../domain/errors.js';
import type { AuditService } from './audit-service.js';

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PAN = /\b(?:\d[ -]*?){13,19}\b/g;
const SECRET = /\b(?:sk|mosaic_pat|mosaic_mcp)[-_][A-Za-z0-9]{8,}\b/g;

function countMatches(text: string, pattern: RegExp): number {
  const copy = new RegExp(pattern.source, pattern.flags);
  return (text.match(copy) ?? []).length;
}

export class RegexContentClassifier implements ContentClassifier {
  inspect(text: string): DlpVerdict {
    const findings = [
      { kind: 'email' as const, count: countMatches(text, EMAIL) },
      { kind: 'pan' as const, count: countMatches(text, PAN) },
      { kind: 'secret' as const, count: countMatches(text, SECRET) },
    ].filter(item => item.count > 0);
    return {
      blocked: findings.length > 0,
      redacted: false,
      findings,
    };
  }

  redact(text: string): { text: string; verdict: DlpVerdict } {
    const verdict = this.inspect(text);
    if (verdict.findings.length === 0) {
      return { text, verdict };
    }
    const next = text
      .replace(EMAIL, '[redacted-email]')
      .replace(PAN, '[redacted-pan]')
      .replace(SECRET, '[redacted-secret]');
    return {
      text: next,
      verdict: { ...verdict, redacted: true, blocked: false },
    };
  }
}

export class DlpService {
  private readonly classifier: ContentClassifier;

  constructor(
    private readonly mode: DlpMode,
    private readonly extras: {
      classifier?: ContentClassifier;
      audit?: AuditService;
    } = {}
  ) {
    this.classifier = extras.classifier ?? new RegexContentClassifier();
  }

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  inspect(text: string): DlpVerdict {
    if (!this.enabled) {
      return { blocked: false, redacted: false, findings: [] };
    }
    return this.classifier.inspect(text);
  }

  applyText(
    text: string,
    ctx?: { workspaceId?: string | null; actorId?: string }
  ): string {
    if (!this.enabled) {
      return text;
    }
    if (this.mode === 'block') {
      const verdict = this.classifier.inspect(text);
      if (verdict.findings.length > 0) {
        void this.extras.audit?.record({
          workspaceId: ctx?.workspaceId ?? null,
          actorId: ctx?.actorId ?? null,
          action: 'dlp.block',
          metadata: { findings: verdict.findings },
        });
        throw errors.dlpBlocked();
      }
      return text;
    }
    const { text: next, verdict } = this.classifier.redact(text);
    if (verdict.redacted) {
      void this.extras.audit?.record({
        workspaceId: ctx?.workspaceId ?? null,
        actorId: ctx?.actorId ?? null,
        action: 'dlp.redact',
        metadata: { findings: verdict.findings },
      });
    }
    return next;
  }

  applyMessages(
    messages: Array<{ role: string; content: string }>,
    ctx?: { workspaceId?: string | null; actorId?: string }
  ): Array<{ role: string; content: string }> {
    return messages.map(message => ({
      ...message,
      content: this.applyText(message.content, ctx),
    }));
  }

  inspectBytes(payload: Uint8Array, mime: string): void {
    if (!this.enabled) {
      return;
    }
    if (
      !mime.startsWith('text/') &&
      mime !== 'application/json' &&
      mime !== 'application/csv'
    ) {
      return;
    }
    const text = Buffer.from(payload).toString('utf8');
    this.applyText(text);
  }
}
