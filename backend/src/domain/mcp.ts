export type McpAccessMode = 'READ_ONLY' | 'READ_WRITE';

export type McpCredentialStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'EXPIRING'
  | 'REVOKED'
  | 'ROTATING';

export interface McpCredential {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  accessMode: McpAccessMode;
  tokenHash: string;
  fingerprint: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  graceEndsAt: Date | null;
}

export const MCP_READ_TOOLS = ['search', 'read_document', 'list_docs'] as const;
export const MCP_WRITE_TOOLS = ['edit_document'] as const;
