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
