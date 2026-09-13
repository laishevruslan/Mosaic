import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type {
  AiStore,
  AuditStore,
  BlobStore,
  Clock,
  IdentityStore,
  ShareStore,
  WorkspaceStore,
} from '../domain/ports.js';
import type { AuditService } from './audit-service.js';
import type { AuthService } from './auth-service.js';
import type { GuardService } from './guard-service.js';
import type { WorkspaceService } from './workspace-service.js';

export interface GdprExport {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  };
  workspaces: Array<{ id: string; name: string; role: string }>;
  publicDocs: Array<{ workspaceId: string; docId: string }>;
  blobs: Array<{ workspaceId: string; key: string; size: number }>;
  copilotSessions: Array<{ id: string; workspaceId: string; promptName: string }>;
  audit: Array<{ id: string; action: string; createdAt: string }>;
}

export class GdprService {
  constructor(
    private readonly identity: IdentityStore,
    private readonly workspaces: WorkspaceService,
    private readonly workspaceStore: WorkspaceStore,
    private readonly shares: ShareStore,
    private readonly blobs: BlobStore,
    private readonly ai: AiStore,
    private readonly auditStore: AuditStore,
    private readonly auth: AuthService,
    private readonly guard: GuardService,
    private readonly clock: Clock,
    private readonly extras: { audit?: AuditService } = {}
  ) {}

  async export(user: User): Promise<GdprExport> {
    const memberships = await this.workspaceStore.listWorkspacesForUser(user.id);
    const publicDocs: GdprExport['publicDocs'] = [];
    const blobs: GdprExport['blobs'] = [];
    for (const workspace of memberships) {
      const docs = await this.shares.listPublicDocs(workspace.id);
      for (const doc of docs) {
        publicDocs.push({ workspaceId: doc.workspaceId, docId: doc.docId });
      }
      const stored = await this.blobs.listBlobs(workspace.id, {});
      for (const blob of stored) {
        blobs.push({
          workspaceId: workspace.id,
          key: blob.key,
          size: blob.size,
        });
      }
    }
    const copilot: GdprExport['copilotSessions'] = [];
    for (const workspace of memberships) {
      const sessions = await this.ai.listCopilotSessions(user.id, workspace.id);
      for (const session of sessions) {
        copilot.push({
          id: session.id,
          workspaceId: session.workspaceId,
          promptName: session.promptName,
        });
      }
    }
    const audit = await this.auditStore.listAudit({
      actorId: user.id,
      take: 500,
    });
    await this.extras.audit?.record({
      actorId: user.id,
      action: 'gdpr.export',
      targetType: 'user',
      targetId: user.id,
    });
    return {
      exportedAt: this.clock.now().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      workspaces: await Promise.all(
        memberships.map(async workspace => {
          const member = await this.workspaceStore.getMember(
            workspace.id,
            user.id
          );
          return {
            id: workspace.id,
            name: workspace.name,
            role: member?.role ?? 'collaborator',
          };
        })
      ),
      publicDocs,
      blobs,
      copilotSessions: copilot.map(session => ({
        id: session.id,
        workspaceId: session.workspaceId,
        promptName: session.promptName,
      })),
      audit: audit.map(event => ({
        id: event.id,
        action: event.action,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async erase(user: User): Promise<boolean> {
    const memberships = await this.workspaceStore.listWorkspacesForUser(user.id);
    for (const workspace of memberships) {
      const member = await this.workspaceStore.getMember(workspace.id, user.id);
      if (member?.role === 'owner') {
        await this.guard.assertNotHeld(workspace.id);
        await this.workspaces.delete(user, workspace.id);
      } else if (member) {
        await this.workspaceStore.removeMember(workspace.id, user.id);
      }
    }
    await this.auth.revokeAllSessionsForUser(user.id);
    const deleted = await this.identity.deleteUser(user.id);
    if (!deleted) {
      throw errors.userNotFound();
    }
    await this.extras.audit?.record({
      actorId: user.id,
      action: 'gdpr.erase',
      targetType: 'user',
      targetId: user.id,
    });
    return true;
  }
}
