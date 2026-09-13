ALTER TABLE copilot_sessions
  ADD COLUMN IF NOT EXISTS parent_session_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT;

ALTER TABLE copilot_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS stream_objects JSONB;

CREATE TABLE IF NOT EXISTS copilot_token_usage (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  used BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS copilot_transcripts (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blob_id TEXT,
  status TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS copilot_transcripts_ws_blob_idx
  ON copilot_transcripts (workspace_id, blob_id);

CREATE TABLE IF NOT EXISTS mcp_credentials (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_mode TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mcp_credentials_ws_idx
  ON mcp_credentials (workspace_id);

CREATE TABLE IF NOT EXISTS calendar_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  status TEXT NOT NULL,
  last_error TEXT,
  refresh_interval_minutes INT NOT NULL DEFAULT 15,
  token_cipher TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES calendar_accounts (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_calendar_id TEXT NOT NULL,
  display_name TEXT,
  timezone TEXT,
  color TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES calendar_subscriptions (id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  recurrence_id TEXT,
  status TEXT,
  title TEXT,
  description TEXT,
  location TEXT,
  start_at_utc TIMESTAMPTZ NOT NULL,
  end_at_utc TIMESTAMPTZ NOT NULL,
  original_timezone TEXT,
  all_day BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS calendar_events_sub_start_idx
  ON calendar_events (subscription_id, start_at_utc);

CREATE TABLE IF NOT EXISTS workspace_calendars (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces (id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  display_name_override TEXT,
  color_override TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS workspace_calendar_items (
  id UUID PRIMARY KEY,
  workspace_calendar_id UUID NOT NULL REFERENCES workspace_calendars (id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL,
  sort_order INT,
  color_override TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS embedding_chunks (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  ordinal INT NOT NULL,
  text TEXT NOT NULL,
  vector JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS embedding_chunks_ws_doc_idx
  ON embedding_chunks (workspace_id, doc_id);

CREATE TABLE IF NOT EXISTS embedding_ignored_docs (
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, doc_id)
);

CREATE TABLE IF NOT EXISTS embedding_artifacts (
  artifact_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS embedding_progress (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
  total INT NOT NULL DEFAULT 0,
  embedded INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS byok_profiles (
  profile_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 1,
  credential_cipher TEXT NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS byok_leases (
  lease_id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS byok_usage (
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  used_on DATE NOT NULL,
  feature_kind TEXT NOT NULL,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, used_on, feature_kind)
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
