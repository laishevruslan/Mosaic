export type AuditActorType = 'user' | 'system' | 'sso';

export interface AuditEvent {
  id: string;
  workspaceId: string | null;
  actorId: string | null;
  actorType: AuditActorType;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditQuery {
  workspaceId?: string;
  actorId?: string;
  action?: string;
  take?: number;
  after?: Date;
}

export const AUDIT_ACTIONS = [
  'auth.sign_in',
  'auth.sign_in_failed',
  'auth.sign_out',
  'auth.sso_login',
  'auth.mfa_enroll',
  'auth.mfa_fail',
  'auth.impersonate',
  'auth.session_revoke',
  'workspace.create',
  'workspace.delete',
  'member.invite',
  'member.accept',
  'member.revoke',
  'member.role_change',
  'share.publish',
  'share.revoke',
  'guest.approve',
  'security.policy_update',
  'org.domain_verify',
  'scim.user.create',
  'scim.user.update',
  'scim.user.disable',
  'scim.group.create',
  'scim.group.update',
  'scim.group.delete',
  'admin.app_config.update',
  'admin.user.disable',
  'admin.user.enable',
  'admin.user.create',
  'admin.user.delete',
  'admin.signing_key.rotate',
  'webhook.create',
  'webhook.delete',
  'webhook.deliver',
  'ai.session_create',
  'ai.completion',
  'ai.embed_job',
  'jira.push',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number] | string;
