export interface SecurityPolicy {
  workspaceId: string | null;
  allowedGuestDomains: string[];
  blockPublicLinks: boolean;
  blockPublicEditLinks: boolean;
  requireSso: boolean;
  requireSsoDomains: string[];
  sessionMaxDurationSec: number | null;
  sessionIdleSec: number | null;
  ipAllowlist: string[];
  updatedAt: Date;
}

export function defaultSecurityPolicy(
  workspaceId: string | null,
  now: Date
): SecurityPolicy {
  return {
    workspaceId,
    allowedGuestDomains: [],
    blockPublicLinks: false,
    blockPublicEditLinks: false,
    requireSso: false,
    requireSsoDomains: [],
    sessionMaxDurationSec: null,
    sessionIdleSec: null,
    ipAllowlist: [],
    updatedAt: now,
  };
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}
