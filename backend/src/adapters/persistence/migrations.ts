export const IDENTITY_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS mosaic_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credentials (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE,
  csrf_token TEXT NOT NULL,
  refresh_token_hash TEXT UNIQUE,
  refresh_expires_at TIMESTAMPTZ,
  access_token_hash TEXT UNIQUE,
  access_expires_at TIMESTAMPTZ,
  exchange_code_hash TEXT UNIQUE,
  exchange_expires_at TIMESTAMPTZ,
  installation_id TEXT,
  platform TEXT,
  device_name TEXT,
  app_version TEXT,
  idle_expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  initialized BOOLEAN NOT NULL DEFAULT TRUE,
  team BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'collaborator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_one_owner
  ON workspace_members (workspace_id)
  WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS instance_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
`;

export const DOCS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  space_type TEXT NOT NULL,
  space_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  snapshot BYTEA,
  timestamp BIGINT NOT NULL DEFAULT 0,
  lifecycle TEXT NOT NULL DEFAULT 'active'
    CHECK (lifecycle IN ('active', 'trash', 'deleted')),
  update_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (space_type, space_id, doc_id)
);

CREATE INDEX IF NOT EXISTS documents_space_idx
  ON documents (space_type, space_id);

CREATE TABLE IF NOT EXISTS doc_updates (
  id BIGSERIAL PRIMARY KEY,
  space_type TEXT NOT NULL,
  space_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  clock BIGINT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (space_type, space_id, doc_id, payload_hash),
  FOREIGN KEY (space_type, space_id, doc_id)
    REFERENCES documents (space_type, space_id, doc_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS doc_updates_doc_clock_idx
  ON doc_updates (space_type, space_id, doc_id, clock);
`;

export const BLOBS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS blobs (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (workspace_id, key)
);

CREATE INDEX IF NOT EXISTS blobs_workspace_live_idx
  ON blobs (workspace_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS blob_uploads (
  id UUID PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  method TEXT NOT NULL,
  part_size INTEGER,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blob_uploads_workspace_key_idx
  ON blob_uploads (workspace_id, key);

CREATE TABLE IF NOT EXISTS blob_upload_parts (
  upload_id UUID NOT NULL REFERENCES blob_uploads (id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  etag TEXT,
  token TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (upload_id, part_number)
);

CREATE TABLE IF NOT EXISTS doc_histories (
  space_type TEXT NOT NULL,
  space_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  snapshot BYTEA NOT NULL,
  editor_id UUID,
  PRIMARY KEY (space_type, space_id, doc_id, timestamp)
);

CREATE INDEX IF NOT EXISTS doc_histories_list_idx
  ON doc_histories (space_type, space_id, doc_id, timestamp DESC);
`;

export const MEMBERS_MIGRATION_SQL = `
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled';
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS enable_sharing BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS enable_url_preview BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS enable_ai BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS invite_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invitee_id UUID REFERENCES users (id) ON DELETE SET NULL,
  inviter_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'collaborator')),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Accepted', 'UnderReview')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_email_idx
  ON workspace_invitations (workspace_id, email);

CREATE TABLE IF NOT EXISTS workspace_invite_links (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expire_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_docs (
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('Page', 'Edgeless')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID,
  PRIMARY KEY (workspace_id, doc_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users (id),
  content JSONB NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_doc_idx
  ON comments (workspace_id, doc_id, created_at, id);

CREATE TABLE IF NOT EXISTS comment_replies (
  id UUID PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comment_replies_comment_idx
  ON comment_replies (comment_id, created_at, id);

CREATE TABLE IF NOT EXISTS comment_changes (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('update', 'delete')),
  item JSONB NOT NULL,
  comment_id UUID,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comment_changes_doc_idx
  ON comment_changes (workspace_id, doc_id, created_at, id);
`;

export const PLATFORM_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  actor_id UUID,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_workspace_idx
  ON audit_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx
  ON audit_events (action, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_security_policies (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
  allowed_guest_domains TEXT[] NOT NULL DEFAULT '{}',
  block_public_links BOOLEAN NOT NULL DEFAULT FALSE,
  require_sso BOOLEAN NOT NULL DEFAULT FALSE,
  require_sso_domains TEXT[] NOT NULL DEFAULT '{}',
  session_max_duration_sec INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instance_security_policy (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  allowed_guest_domains TEXT[] NOT NULL DEFAULT '{}',
  block_public_links BOOLEAN NOT NULL DEFAULT FALSE,
  require_sso BOOLEAN NOT NULL DEFAULT FALSE,
  require_sso_domains TEXT[] NOT NULL DEFAULT '{}',
  session_max_duration_sec INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_webhooks (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_webhooks_workspace_idx
  ON workspace_webhooks (workspace_id);

CREATE TABLE IF NOT EXISTS copilot_sessions (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  doc_id TEXT,
  prompt_name TEXT NOT NULL,
  title TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_sessions_user_ws_idx
  ON copilot_sessions (user_id, workspace_id);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES copilot_sessions (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_messages_session_idx
  ON copilot_messages (session_id, created_at);
`;

export const JOBS_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'Default',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read = FALSE;

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  receive_invitation_email BOOLEAN NOT NULL DEFAULT TRUE,
  receive_mention_email BOOLEAN NOT NULL DEFAULT TRUE,
  receive_comment_email BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS outbox_emails (
  id UUID PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  text TEXT NOT NULL,
  html TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_emails_pending_idx
  ON outbox_emails (scheduled_at, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_queue_due_idx
  ON job_queue (run_at, created_at)
  WHERE status IN ('pending', 'failed');
`;

export const E0_MIGRATION_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS enable_doc_embedding BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS avatar_key TEXT;

ALTER TABLE workspace_security_policies
  ADD COLUMN IF NOT EXISTS block_public_edit_links BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspace_security_policies
  ADD COLUMN IF NOT EXISTS session_idle_sec INTEGER;
ALTER TABLE workspace_security_policies
  ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE instance_security_policy
  ADD COLUMN IF NOT EXISTS block_public_edit_links BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE instance_security_policy
  ADD COLUMN IF NOT EXISTS session_idle_sec INTEGER;
ALTER TABLE instance_security_policy
  ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  jit_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  require_mfa TEXT NOT NULL DEFAULT 'off'
    CHECK (require_mfa IN ('off', 'all', 'if_not_sso')),
  ip_allowlist TEXT[] NOT NULL DEFAULT '{}',
  audit_retention_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_domains (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  token TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, domain)
);

CREATE INDEX IF NOT EXISTS org_domains_domain_idx ON org_domains (domain);

CREATE TABLE IF NOT EXISTS organization_idp (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL UNIQUE REFERENCES organizations (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('oidc', 'saml')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  issuer TEXT,
  client_id TEXT,
  client_secret TEXT,
  sso_url TEXT,
  entity_id TEXT,
  certificate TEXT,
  group_claim TEXT,
  group_role_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scim_tokens (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS scim_users (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  emails TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, external_id),
  UNIQUE (org_id, user_name)
);

CREATE TABLE IF NOT EXISTS scim_groups (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  members TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, external_id)
);

CREATE TABLE IF NOT EXISTS user_totp (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, code_hash)
);

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mfa_challenges_expires_idx ON mfa_challenges (expires_at);
`;

export const E2_MIGRATION_SQL = `
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
`;

export const E3_MIGRATION_SQL = `
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
`;

export const E4_MIGRATION_SQL = `
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
`;
