import type postgres from 'postgres';

import type { DocSensitivity, RetentionPolicy, SensitivityLabel } from '../../domain/guard.js';
import type { GuardStore } from '../../domain/ports.js';
import { PostgresE2Store } from './postgres-e2.js';

interface SensitivityRow {
  workspace_id: string;
  doc_id: string;
  label: SensitivityLabel;
  updated_at: Date;
  updated_by: string;
}

interface RetentionRow {
  workspace_id: string;
  retention_days: number | null;
  legal_hold: boolean;
  updated_at: Date;
  updated_by: string | null;
}

function mapSensitivity(row: SensitivityRow): DocSensitivity {
  return {
    workspaceId: row.workspace_id,
    docId: row.doc_id,
    label: row.label,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapRetention(row: RetentionRow): RetentionPolicy {
  return {
    workspaceId: row.workspace_id,
    retentionDays: row.retention_days,
    legalHold: row.legal_hold,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export class PostgresE3Store extends PostgresE2Store implements GuardStore {
  constructor(sql: postgres.Sql) {
    super(sql);
  }

  async getDocSensitivity(
    workspaceId: string,
    docId: string
  ): Promise<DocSensitivity | null> {
    const [row] = await this.sql<SensitivityRow[]>`
      SELECT * FROM doc_sensitivity
      WHERE workspace_id = ${workspaceId} AND doc_id = ${docId}
    `;
    return row ? mapSensitivity(row) : null;
  }

  async setDocSensitivity(record: DocSensitivity): Promise<DocSensitivity> {
    await this.sql`
      INSERT INTO doc_sensitivity (
        workspace_id, doc_id, label, updated_at, updated_by
      ) VALUES (
        ${record.workspaceId}, ${record.docId}, ${record.label},
        ${record.updatedAt}, ${record.updatedBy}
      )
      ON CONFLICT (workspace_id, doc_id) DO UPDATE SET
        label = EXCLUDED.label,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
    `;
    return record;
  }

  async listDocSensitivities(workspaceId: string): Promise<DocSensitivity[]> {
    const rows = await this.sql<SensitivityRow[]>`
      SELECT * FROM doc_sensitivity WHERE workspace_id = ${workspaceId}
    `;
    return rows.map(mapSensitivity);
  }

  async getRetentionPolicy(
    workspaceId: string
  ): Promise<RetentionPolicy | null> {
    const [row] = await this.sql<RetentionRow[]>`
      SELECT * FROM workspace_retention_policies
      WHERE workspace_id = ${workspaceId}
    `;
    return row ? mapRetention(row) : null;
  }

  async setRetentionPolicy(policy: RetentionPolicy): Promise<RetentionPolicy> {
    await this.sql`
      INSERT INTO workspace_retention_policies (
        workspace_id, retention_days, legal_hold, updated_at, updated_by
      ) VALUES (
        ${policy.workspaceId}, ${policy.retentionDays}, ${policy.legalHold},
        ${policy.updatedAt}, ${policy.updatedBy}
      )
      ON CONFLICT (workspace_id) DO UPDATE SET
        retention_days = EXCLUDED.retention_days,
        legal_hold = EXCLUDED.legal_hold,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
    `;
    return policy;
  }
}
