export const JOB_NAMES = [
  'doc.compact',
  'blob.gc',
  'mail.send',
  'webhook.retry',
  'index.document',
  'embed.document',
  'audit.purge',
  'copilot.transcript',
  'calendar.sync',
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobRecord {
  id: string;
  name: JobName;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
}

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}
