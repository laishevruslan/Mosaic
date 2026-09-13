import type { DocSensitivity, RetentionPolicy } from '../../domain/guard.js';
import type { GuardStore } from '../../domain/ports.js';
import { MemoryE2Store } from './e2-memory.js';

function cloneSensitivity(row: DocSensitivity): DocSensitivity {
  return { ...row, updatedAt: new Date(row.updatedAt) };
}

function cloneRetention(row: RetentionPolicy): RetentionPolicy {
  return {
    ...row,
    updatedAt: new Date(row.updatedAt),
  };
}

export class MemoryE3Store extends MemoryE2Store implements GuardStore {
  private readonly sensitivities = new Map<string, DocSensitivity>();
  private readonly retention = new Map<string, RetentionPolicy>();

  async getDocSensitivity(
    workspaceId: string,
    docId: string
  ): Promise<DocSensitivity | null> {
    const row = this.sensitivities.get(`${workspaceId}:${docId}`);
    return row ? cloneSensitivity(row) : null;
  }

  async setDocSensitivity(record: DocSensitivity): Promise<DocSensitivity> {
    this.sensitivities.set(
      `${record.workspaceId}:${record.docId}`,
      cloneSensitivity(record)
    );
    return cloneSensitivity(record);
  }

  async listDocSensitivities(workspaceId: string): Promise<DocSensitivity[]> {
    return [...this.sensitivities.values()]
      .filter(row => row.workspaceId === workspaceId)
      .map(cloneSensitivity);
  }

  async getRetentionPolicy(
    workspaceId: string
  ): Promise<RetentionPolicy | null> {
    const row = this.retention.get(workspaceId);
    return row ? cloneRetention(row) : null;
  }

  async setRetentionPolicy(policy: RetentionPolicy): Promise<RetentionPolicy> {
    this.retention.set(policy.workspaceId, cloneRetention(policy));
    return cloneRetention(policy);
  }
}
