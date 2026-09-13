import { applyUpdate, Doc as YDoc } from 'yjs';

import { errors } from '../domain/errors.js';
import type { User } from '../domain/identity.js';
import type {
  McpAccessMode,
  McpCredential,
  McpCredentialStatus,
} from '../domain/mcp.js';
import { MCP_READ_TOOLS, MCP_WRITE_TOOLS } from '../domain/mcp.js';
import type { Clock, DocStore, McpStore } from '../domain/ports.js';
import type { AuditService } from './audit-service.js';
import { randomToken, sha256 } from './crypto.js';
import type { SearchService } from './search-service.js';
import type { WorkspaceService } from './workspace-service.js';

export function mcpStatus(
  credential: McpCredential,
  now: Date
): McpCredentialStatus {
  if (credential.revokedAt) {
    if (credential.graceEndsAt && now < credential.graceEndsAt) {
      return 'ROTATING';
    }
    return 'REVOKED';
  }
  if (now >= credential.expiresAt) {
    return 'EXPIRED';
  }
  const week = 7 * 24 * 60 * 60 * 1000;
  if (credential.expiresAt.getTime() - now.getTime() < week) {
    return 'EXPIRING';
  }
  return 'ACTIVE';
}

function fingerprintOf(hash: string): string {
  return hash.slice(0, 8);
}

function yjsText(snapshot: Uint8Array | null, updates: Uint8Array[]): string {
  const doc = new YDoc();
  if (snapshot && snapshot.byteLength > 0) {
    applyUpdate(doc, snapshot);
  }
  for (const update of updates) {
    applyUpdate(doc, update);
  }
  const parts: string[] = [];
  doc.share.forEach((_abstract, key) => {
    const text = doc.getText(key).toString();
    if (text) {
      parts.push(text);
    }
  });
  return parts.join('\n');
}

export class McpService {
  constructor(
    private readonly store: McpStore,
    private readonly docs: DocStore,
    private readonly search: SearchService,
    private readonly workspaces: WorkspaceService,
    private readonly clock: Clock,
    private readonly publicUrl: string,
    private readonly writeEnabled: boolean,
    private readonly audit?: AuditService
  ) {}

  readWriteAvailable(): boolean {
    return this.writeEnabled;
  }

  endpoint(workspaceId: string): {
    url: string;
    protocol: string;
    auth: { type: string };
    tools: string[];
  } {
    const tools: string[] = [...MCP_READ_TOOLS];
    if (this.writeEnabled) {
      tools.push(...MCP_WRITE_TOOLS);
    }
    return {
      url: `${this.publicUrl.replace(/\/$/, '')}/api/workspaces/${workspaceId}/mcp`,
      protocol: 'http',
      auth: { type: 'bearer' },
      tools,
    };
  }

  async create(
    user: User,
    input: {
      workspaceId: string;
      name: string;
      accessMode?: McpAccessMode | null;
      expirationDays?: number | null;
    }
  ): Promise<{ credential: McpCredential; token: string }> {
    await this.workspaces.requireAdmin(user, input.workspaceId);
    const now = this.clock.now();
    const days = Math.min(365, Math.max(1, input.expirationDays ?? 90));
    const token = `mosaic_mcp_${randomToken(24)}`;
    const tokenHash = sha256(token);
    const credential = await this.store.createMcpCredential({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      userId: user.id,
      name: input.name,
      accessMode: input.accessMode ?? 'READ_ONLY',
      tokenHash,
      fingerprint: fingerprintOf(tokenHash),
      createdAt: now,
      expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
      lastUsedAt: null,
      revokedAt: null,
      graceEndsAt: null,
    });
    await this.audit?.record({
      workspaceId: input.workspaceId,
      actorId: user.id,
      action: 'mcp.credential.create',
      targetType: 'mcp_credential',
      targetId: credential.id,
    });
    return { credential, token };
  }

  async list(user: User, workspaceId: string): Promise<McpCredential[]> {
    await this.workspaces.requireMember(user, workspaceId);
    return this.store.listMcpCredentials(workspaceId);
  }

  async revoke(user: User, workspaceId: string, id: string): Promise<boolean> {
    await this.workspaces.requireAdmin(user, workspaceId);
    const credential = await this.store.getMcpCredential(id);
    if (!credential || credential.workspaceId !== workspaceId) {
      throw errors.mcpCredentialNotFound();
    }
    await this.store.updateMcpCredential(id, {
      revokedAt: this.clock.now(),
    });
    await this.audit?.record({
      workspaceId,
      actorId: user.id,
      action: 'mcp.credential.revoke',
      targetType: 'mcp_credential',
      targetId: id,
    });
    return true;
  }

  async rotate(
    user: User,
    workspaceId: string,
    id: string,
    expirationDays: number
  ): Promise<{ credential: McpCredential; token: string }> {
    await this.workspaces.requireAdmin(user, workspaceId);
    const credential = await this.store.getMcpCredential(id);
    if (!credential || credential.workspaceId !== workspaceId) {
      throw errors.mcpCredentialNotFound();
    }
    const now = this.clock.now();
    const token = `mosaic_mcp_${randomToken(24)}`;
    const tokenHash = sha256(token);
    const days = Math.min(365, Math.max(1, expirationDays));
    const updated = await this.store.updateMcpCredential(id, {
      tokenHash,
      fingerprint: fingerprintOf(tokenHash),
      expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
      graceEndsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      revokedAt: null,
    });
    await this.audit?.record({
      workspaceId,
      actorId: user.id,
      action: 'mcp.credential.rotate',
      targetType: 'mcp_credential',
      targetId: id,
    });
    return { credential: updated, token };
  }

  async authenticate(
    workspaceId: string,
    bearer: string | undefined
  ): Promise<McpCredential> {
    if (!bearer) {
      throw errors.authenticationRequired();
    }
    const credential = await this.store.findMcpCredentialByHash(sha256(bearer));
    const now = this.clock.now();
    if (
      !credential ||
      credential.workspaceId !== workspaceId ||
      credential.revokedAt ||
      now >= credential.expiresAt
    ) {
      throw errors.authenticationRequired();
    }
    await this.store.updateMcpCredential(credential.id, { lastUsedAt: now });
    return credential;
  }

  async listTools(credential: McpCredential): Promise<
    Array<{ name: string; description: string }>
  > {
    const tools = [
      { name: 'search', description: 'Search documents in the workspace.' },
      { name: 'read_document', description: 'Read a document by id.' },
      { name: 'list_docs', description: 'List document ids in the workspace.' },
    ];
    if (this.writeEnabled && credential.accessMode === 'READ_WRITE') {
      tools.push({
        name: 'edit_document',
        description: 'Reserved write tool; disabled unless MCP write is enabled.',
      });
    }
    return tools;
  }

  async callTool(
    credential: McpCredential,
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (name === 'search') {
      const query = typeof args.query === 'string' ? args.query : '';
      return this.search.searchDocs(credential.workspaceId, query, 20);
    }
    if (name === 'list_docs') {
      const timestamps = await this.docs.listTimestamps(
        'workspace',
        credential.workspaceId
      );
      return { docs: Object.keys(timestamps) };
    }
    if (name === 'read_document') {
      const docId = typeof args.docId === 'string' ? args.docId : '';
      if (!docId) {
        throw errors.badRequest('docId is required.');
      }
      const record = await this.docs.getDocument(
        'workspace',
        credential.workspaceId,
        docId
      );
      if (!record) {
        throw errors.badRequest('Document not found.');
      }
      const updates = await this.docs.listUpdates(
        'workspace',
        credential.workspaceId,
        docId
      );
      return {
        docId,
        text: yjsText(
          record.snapshot,
          updates.map(item => item.payload)
        ),
      };
    }
    if (name === 'edit_document') {
      if (!this.writeEnabled || credential.accessMode !== 'READ_WRITE') {
        throw errors.actionForbidden('MCP write tools are disabled.');
      }
      throw errors.actionForbidden('edit_document is not enabled.');
    }
    throw errors.badRequest(`Unknown MCP tool: ${name}`);
  }
}
