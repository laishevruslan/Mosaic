CREATE TABLE IF NOT EXISTS doc_sensitivity (
  workspace_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  label TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (workspace_id, doc_id)
);

CREATE TABLE IF NOT EXISTS workspace_retention_policies (
  workspace_id TEXT PRIMARY KEY,
  retention_days INTEGER,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT
);
