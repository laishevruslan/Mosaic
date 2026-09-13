CREATE TABLE IF NOT EXISTS search_documents (
  workspace_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  block_id TEXT NOT NULL DEFAULT '',
  flavour TEXT NOT NULL DEFAULT 'affine:page',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, doc_id, block_id)
);

CREATE INDEX IF NOT EXISTS search_documents_workspace_idx
  ON search_documents (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS search_documents_fts_idx
  ON search_documents
  USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, '')));

CREATE TABLE IF NOT EXISTS share_link_stats (
  workspace_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  unique_views INTEGER NOT NULL DEFAULT 0,
  guest_views INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  visitor_keys TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (workspace_id, doc_id)
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  day DATE PRIMARY KEY,
  workspace_storage_bytes BIGINT NOT NULL DEFAULT 0,
  blob_storage_bytes BIGINT NOT NULL DEFAULT 0,
  copilot_conversations INTEGER NOT NULL DEFAULT 0,
  sync_active_users INTEGER NOT NULL DEFAULT 0
);
