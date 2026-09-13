import { getRequestContext } from './request-context.js';

export interface TraceSpan {
  name: string;
  traceId: string;
  spanId: string;
  startedAt: number;
}

interface OtlpSpan {
  name: string;
  traceId: string;
  spanId: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, unknown>;
}

function randomSpanId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Buffer.from(bytes).toString('hex');
}

function nano(ms: number): string {
  return `${BigInt(ms) * 1_000_000n}`;
}

function hexTraceId(traceId: string): string {
  const hex = traceId.replaceAll(/[^a-fA-F0-9]/g, '').padStart(32, '0');
  return hex.slice(0, 32);
}

/**
 * Optional OTLP/HTTP JSON exporter. When OTEL_EXPORTER_OTLP_ENDPOINT is unset
 * this is a no-op besides request-scoped span ids. Avoids the full OTel SDK.
 */
export class TracingSkeleton {
  private readonly buffer: OtlpSpan[] = [];
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private readonly tracesUrl: string | undefined;

  constructor(
    private readonly serviceName: string,
    otlpEndpoint: string | undefined,
    private readonly log: (
      payload: Record<string, unknown>,
      msg: string
    ) => void,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(
      globalThis
    )
  ) {
    this.tracesUrl = otlpEndpoint
      ? joinOtlpUrl(otlpEndpoint, '/v1/traces')
      : undefined;
    if (this.tracesUrl) {
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, 2_000);
      this.flushTimer.unref?.();
    }
  }

  startSpan(name: string): TraceSpan {
    const ctx = getRequestContext();
    return {
      name,
      traceId: ctx?.traceId ?? 'untraced',
      spanId: randomSpanId(),
      startedAt: Date.now(),
    };
  }

  endSpan(span: TraceSpan, extra?: Record<string, unknown>): void {
    const durationMs = Date.now() - span.startedAt;
    if (!this.tracesUrl) {
      return;
    }
    this.log(
      {
        service: this.serviceName,
        span: span.name,
        traceId: span.traceId,
        durationMs,
        exporter: this.tracesUrl,
        ...extra,
      },
      'span'
    );
    this.buffer.push({
      name: span.name,
      traceId: hexTraceId(span.traceId),
      spanId: span.spanId,
      startTimeUnixNano: nano(span.startedAt),
      endTimeUnixNano: nano(span.startedAt + durationMs),
      attributes: extra ?? {},
    });
    if (this.buffer.length >= 32) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.tracesUrl || this.buffer.length === 0) {
      return;
    }
    const spans = this.buffer.splice(0, this.buffer.length);
    const body = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.serviceName },
              },
            ],
          },
          scopeSpans: [
            {
              scope: { name: this.serviceName },
              spans: spans.map(span => ({
                name: span.name,
                traceId: span.traceId,
                spanId: span.spanId,
                kind: 1,
                startTimeUnixNano: span.startTimeUnixNano,
                endTimeUnixNano: span.endTimeUnixNano,
                attributes: Object.entries(span.attributes).map(
                  ([key, value]) => ({
                    key,
                    value:
                      typeof value === 'number'
                        ? { intValue: String(Math.trunc(value)) }
                        : { stringValue: String(value) },
                  })
                ),
              })),
            },
          ],
        },
      ],
    };
    try {
      await this.fetchImpl(this.tracesUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      this.log(
        { err: error instanceof Error ? error.message : String(error) },
        'otlp_export_failed'
      );
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
  }
}

function joinOtlpUrl(endpoint: string, path: string): string {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1/traces')) {
    return trimmed;
  }
  return `${trimmed}${path}`;
}
