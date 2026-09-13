import { randomUUID } from 'node:crypto';

import type { JobName, JobRecord } from '../../domain/jobs.js';
import type { Clock, JobStore } from '../../domain/ports.js';

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export class JobWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly workerId = randomUUID();
  private running = false;

  constructor(
    private readonly store: JobStore,
    private readonly clock: Clock,
    private readonly handlers: Record<string, JobHandler>,
    private readonly opts: {
      pollMs: number;
      concurrency: number;
      inline: boolean;
    }
  ) {}

  async enqueue(
    name: JobName,
    payload: Record<string, unknown>,
    opts?: { delayMs?: number; maxAttempts?: number }
  ): Promise<JobRecord> {
    const now = this.clock.now();
    const job = await this.store.enqueueJob({
      id: randomUUID(),
      name,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 8,
      runAt: new Date(now.getTime() + (opts?.delayMs ?? 0)),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      createdAt: now,
    });
    if (this.opts.inline) {
      await this.drain();
    }
    return job;
  }

  start(): void {
    if (this.opts.inline || this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.drain();
    }, this.opts.pollMs);
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.drain();
  }

  async drain(): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    let processed = 0;
    try {
      for (;;) {
        const now = this.clock.now();
        const lockUntil = new Date(now.getTime() + 60_000);
        const claimed = await this.store.claimDueJobs(
          this.opts.concurrency,
          now,
          lockUntil,
          this.workerId
        );
        if (claimed.length === 0) {
          break;
        }
        for (const job of claimed) {
          await this.process(job);
          processed += 1;
        }
      }
    } finally {
      this.running = false;
    }
    return processed;
  }

  private async process(job: JobRecord): Promise<void> {
    const handler = this.handlers[job.name];
    if (!handler) {
      await this.store.completeJob(job.id);
      return;
    }
    try {
      await handler(job.payload);
      await this.store.completeJob(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = job.attempts + 1;
      if (attempts >= job.maxAttempts) {
        await this.store.failJob(job.id, message, null);
        return;
      }
      const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 8));
      await this.store.failJob(
        job.id,
        message,
        new Date(this.clock.now().getTime() + delayMs)
      );
    }
  }
}
