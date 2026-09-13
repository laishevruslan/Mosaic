import {
  defaultRetentionPolicy,
  isSensitivityLabel,
  type DocSensitivity,
  type RetentionPolicy,
  type SensitivityLabel,
} from '../domain/guard.js';
import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type { Clock, GuardStore, ShareStore } from '../domain/ports.js';
import type { AuditService } from './audit-service.js';
import type { WorkspaceService } from './workspace-service.js';

export class GuardService {
  constructor(
    private readonly store: GuardStore,
    private readonly workspaces: WorkspaceService,
    private readonly clock: Clock,
    private readonly extras: {
      audit?: AuditService;
      shares?: ShareStore;
      confidentialBlocksPublic?: boolean;
    } = {}
  ) {}

  async labelOf(workspaceId: string, docId: string): Promise<SensitivityLabel> {
    const row = await this.store.getDocSensitivity(workspaceId, docId);
    return row?.label ?? 'Public';
  }

  async setLabel(
    user: User,
    workspaceId: string,
    docId: string,
    label: string
  ): Promise<DocSensitivity> {
    await this.workspaces.requireAdmin(user, workspaceId);
    if (!isSensitivityLabel(label)) {
      throw errors.badRequest('Unknown sensitivity label.');
    }
    const record = await this.store.setDocSensitivity({
      workspaceId,
      docId,
      label,
      updatedAt: this.clock.now(),
      updatedBy: user.id,
    });
    if (label === 'Confidential') {
      await this.extras.shares?.revokePublicDoc(workspaceId, docId);
    }
    await this.extras.audit?.record({
      workspaceId,
      actorId: user.id,
      action: 'guard.sensitivity',
      targetType: 'doc',
      targetId: docId,
      metadata: { label },
    });
    return record;
  }

  async assertCanPublish(workspaceId: string, docId: string): Promise<void> {
    if (this.extras.confidentialBlocksPublic === false) {
      return;
    }
    const label = await this.labelOf(workspaceId, docId);
    if (label === 'Confidential') {
      throw errors.sensitivityBlocksShare();
    }
  }

  async retentionOf(workspaceId: string): Promise<RetentionPolicy> {
    return (
      (await this.store.getRetentionPolicy(workspaceId)) ??
      defaultRetentionPolicy(workspaceId)
    );
  }

  async setRetention(
    user: User,
    workspaceId: string,
    input: { retentionDays?: number | null; legalHold?: boolean | null }
  ): Promise<RetentionPolicy> {
    await this.workspaces.requireAdmin(user, workspaceId);
    const current = await this.retentionOf(workspaceId);
    const next: RetentionPolicy = {
      workspaceId,
      retentionDays:
        input.retentionDays === undefined
          ? current.retentionDays
          : input.retentionDays,
      legalHold:
        input.legalHold === undefined ? current.legalHold : Boolean(input.legalHold),
      updatedAt: this.clock.now(),
      updatedBy: user.id,
    };
    const saved = await this.store.setRetentionPolicy(next);
    await this.extras.audit?.record({
      workspaceId,
      actorId: user.id,
      action: next.legalHold ? 'guard.legal_hold' : 'guard.retention',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: {
        retentionDays: next.retentionDays,
        legalHold: next.legalHold,
      },
    });
    return saved;
  }

  async isHeld(workspaceId: string): Promise<boolean> {
    return (await this.retentionOf(workspaceId)).legalHold;
  }

  async assertNotHeld(workspaceId: string): Promise<void> {
    if (await this.isHeld(workspaceId)) {
      throw errors.legalHoldActive();
    }
  }

  async canPhysicallyDelete(
    workspaceId: string,
    deletedAt: Date | null
  ): Promise<boolean> {
    const policy = await this.retentionOf(workspaceId);
    if (policy.legalHold) {
      return false;
    }
    if (!deletedAt || policy.retentionDays == null) {
      return true;
    }
    const unlockAt =
      deletedAt.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000;
    return this.clock.now().getTime() >= unlockAt;
  }
}
