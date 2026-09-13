export const SENSITIVITY_LABELS = [
  'Public',
  'Internal',
  'Confidential',
] as const;

export type SensitivityLabel = (typeof SENSITIVITY_LABELS)[number];

export function isSensitivityLabel(value: string): value is SensitivityLabel {
  return (SENSITIVITY_LABELS as readonly string[]).includes(value);
}

export interface DocSensitivity {
  workspaceId: string;
  docId: string;
  label: SensitivityLabel;
  updatedAt: Date;
  updatedBy: string;
}

export interface RetentionPolicy {
  workspaceId: string;
  retentionDays: number | null;
  legalHold: boolean;
  updatedAt: Date;
  updatedBy: string | null;
}

export function defaultRetentionPolicy(workspaceId: string): RetentionPolicy {
  return {
    workspaceId,
    retentionDays: null,
    legalHold: false,
    updatedAt: new Date(0),
    updatedBy: null,
  };
}
