import { Button } from '@affine/admin/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@affine/admin/components/ui/card';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import { ScrollArea } from '@affine/admin/components/ui/scroll-area';
import { Switch } from '@affine/admin/components/ui/switch';
import { useI18n } from '@affine/i18n';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Header } from '../header';
import { adminGql } from '../gql';

interface Organization {
  id: string;
  name: string;
  jitEnabled: boolean;
  requireMfa: string;
  ipAllowlist: string[];
}

interface OrgDomain {
  id: string;
  domain: string;
  token: string;
  verifiedAt: string | null;
  txtRecord: string;
}

interface OrganizationIdp {
  kind: string;
  enabled: boolean;
  issuer: string | null;
  clientId: string | null;
  configured: boolean;
  ssoUrl: string | null;
  entityId: string | null;
  groupClaim: string | null;
}

interface ScimToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  token?: string | null;
}

interface SecurityPolicy {
  allowedGuestDomains: string[];
  blockPublicLinks: boolean;
  blockPublicEditLinks: boolean;
  requireSso: boolean;
  requireSsoDomains: string[];
  sessionIdleSec: number | null;
  sessionMaxDurationSec: number | null;
  ipAllowlist: string[];
}

const LOAD_QUERY = `query AdminSecurity {
  organization { id name jitEnabled requireMfa ipAllowlist }
  organizationDomains { id domain token verifiedAt txtRecord }
  organizationIdp {
    kind enabled issuer clientId configured ssoUrl entityId groupClaim
  }
  scimTokens { id name createdAt lastUsedAt }
  instanceSecurityPolicy {
    allowedGuestDomains
    blockPublicLinks
    blockPublicEditLinks
    requireSso
    requireSsoDomains
    sessionIdleSec
    sessionMaxDurationSec
    ipAllowlist
  }
}`;

function csv(values: string[]): string {
  return values.join(', ');
}

function fromCsv(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function SecurityPage() {
  const t = useI18n();
  const [org, setOrg] = useState<Organization | null>(null);
  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [idp, setIdp] = useState<OrganizationIdp>({
    kind: 'oidc',
    enabled: true,
    issuer: '',
    clientId: '',
    configured: false,
    ssoUrl: '',
    entityId: '',
    groupClaim: 'groups',
  });
  const [clientSecret, setClientSecret] = useState('');
  const [certificate, setCertificate] = useState('');
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [tokenName, setTokenName] = useState('SCIM');
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [guestDomains, setGuestDomains] = useState('');
  const [ssoDomains, setSsoDomains] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');

  const load = useCallback(async () => {
    const data = await adminGql<{
      organization: Organization | null;
      organizationDomains: OrgDomain[];
      organizationIdp: OrganizationIdp | null;
      scimTokens: ScimToken[];
      instanceSecurityPolicy: SecurityPolicy;
    }>(LOAD_QUERY);
    setOrg(data.organization);
    setDomains(data.organizationDomains);
    if (data.organizationIdp) {
      setIdp({
        ...data.organizationIdp,
        issuer: data.organizationIdp.issuer ?? '',
        clientId: data.organizationIdp.clientId ?? '',
        ssoUrl: data.organizationIdp.ssoUrl ?? '',
        entityId: data.organizationIdp.entityId ?? '',
        groupClaim: data.organizationIdp.groupClaim ?? 'groups',
      });
    }
    setTokens(data.scimTokens);
    setPolicy(data.instanceSecurityPolicy);
    setGuestDomains(csv(data.instanceSecurityPolicy.allowedGuestDomains));
    setSsoDomains(csv(data.instanceSecurityPolicy.requireSsoDomains));
    setIpAllowlist(
      csv(
        data.organization?.ipAllowlist.length
          ? data.organization.ipAllowlist
          : data.instanceSecurityPolicy.ipAllowlist
      )
    );
  }, []);

  useEffect(() => {
    load().catch(error => toast.error((error as Error).message));
  }, [load]);

  const saveOrg = async () => {
    if (!org) {
      return;
    }
    await adminGql(
      `mutation UpdateOrganization($input: OrganizationUpdateInput!) {
        updateOrganization(input: $input) { id name jitEnabled requireMfa ipAllowlist }
      }`,
      {
        input: {
          name: org.name,
          jitEnabled: org.jitEnabled,
          requireMfa: org.requireMfa,
          ipAllowlist: fromCsv(ipAllowlist),
        },
      }
    );
    toast.success(t.t('com.affine.admin.security.saved'));
    await load();
  };

  const savePolicy = async () => {
    if (!policy) {
      return;
    }
    await adminGql(
      `mutation UpdateInstanceSecurityPolicy($input: SecurityPolicyInput!) {
        updateInstanceSecurityPolicy(input: $input) {
          requireSso
          requireSsoDomains
          allowedGuestDomains
          blockPublicLinks
          blockPublicEditLinks
          sessionIdleSec
          sessionMaxDurationSec
          ipAllowlist
        }
      }`,
      {
        input: {
          requireSso: policy.requireSso,
          requireSsoDomains: fromCsv(ssoDomains),
          allowedGuestDomains: fromCsv(guestDomains),
          blockPublicLinks: policy.blockPublicLinks,
          blockPublicEditLinks: policy.blockPublicEditLinks,
          sessionIdleSec: policy.sessionIdleSec,
          sessionMaxDurationSec: policy.sessionMaxDurationSec,
          ipAllowlist: fromCsv(ipAllowlist),
        },
      }
    );
    toast.success(t.t('com.affine.admin.security.saved'));
    await load();
  };

  return (
    <div className="flex h-dvh flex-1 flex-col">
      <Header title={t.t('com.affine.admin.security.title')} />
      <ScrollArea>
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.t('com.affine.admin.security.organization')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.name')}</Label>
                <Input
                  value={org?.name ?? ''}
                  onChange={event =>
                    setOrg(current =>
                      current
                        ? { ...current, name: event.target.value }
                        : current
                    )
                  }
                />
              </div>
              <label className="flex items-center justify-between gap-4">
                <span>{t.t('com.affine.admin.security.jit')}</span>
                <Switch
                  checked={org?.jitEnabled ?? true}
                  onCheckedChange={checked =>
                    setOrg(current =>
                      current ? { ...current, jitEnabled: checked } : current
                    )
                  }
                />
              </label>
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.mfa')}</Label>
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={org?.requireMfa ?? 'off'}
                  onChange={event =>
                    setOrg(current =>
                      current
                        ? { ...current, requireMfa: event.target.value }
                        : current
                    )
                  }
                >
                  <option value="off">
                    {t.t('com.affine.admin.security.mfa.off')}
                  </option>
                  <option value="all">
                    {t.t('com.affine.admin.security.mfa.all')}
                  </option>
                  <option value="if_not_sso">
                    {t.t('com.affine.admin.security.mfa.sso')}
                  </option>
                </select>
              </div>
              <Button onClick={() => saveOrg().catch(err => toast.error(err.message))}>
                {t.t('com.affine.admin.security.save')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.t('com.affine.admin.security.domains.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {domains.map(domain => (
                <div
                  key={domain.id}
                  className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{domain.domain}</span>
                    <span className="text-muted-foreground">
                      {domain.verifiedAt
                        ? t.t('com.affine.admin.security.domains.verified')
                        : t.t('com.affine.admin.security.domains.pending')}
                    </span>
                  </div>
                  <code className="break-all text-xs">{domain.txtRecord}</code>
                  <div className="flex gap-2">
                    {domain.verifiedAt ? null : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          adminGql(
                            `mutation VerifyOrganizationDomain($id: String!) {
                              verifyOrganizationDomain(id: $id) { id verifiedAt }
                            }`,
                            { id: domain.id }
                          )
                            .then(load)
                            .catch(error => toast.error((error as Error).message))
                        }
                      >
                        {t.t('com.affine.admin.security.domains.verify')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        adminGql(
                          `mutation DeleteOrganizationDomain($id: String!) {
                            deleteOrganizationDomain(id: $id)
                          }`,
                          { id: domain.id }
                        )
                          .then(load)
                          .catch(error => toast.error((error as Error).message))
                      }
                    >
                      {t.t('com.affine.admin.security.domains.delete')}
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={event => setNewDomain(event.target.value)}
                />
                <Button
                  onClick={() =>
                    adminGql(
                      `mutation AddOrganizationDomain($domain: String!) {
                        addOrganizationDomain(domain: $domain) { id domain txtRecord }
                      }`,
                      { domain: newDomain }
                    )
                      .then(() => {
                        setNewDomain('');
                        return load();
                      })
                      .catch(error => toast.error((error as Error).message))
                  }
                >
                  {t.t('com.affine.admin.security.domains.add')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.t('com.affine.admin.security.sso.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.sso.kind')}</Label>
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={idp.kind}
                  onChange={event =>
                    setIdp(current => ({ ...current, kind: event.target.value }))
                  }
                >
                  <option value="oidc">OIDC</option>
                  <option value="saml">SAML</option>
                </select>
              </div>
              <label className="flex items-center justify-between gap-4">
                <span>{t.t('com.affine.admin.security.sso.enabled')}</span>
                <Switch
                  checked={idp.enabled}
                  onCheckedChange={checked =>
                    setIdp(current => ({ ...current, enabled: checked }))
                  }
                />
              </label>
              <Input
                placeholder="Issuer / Entity ID"
                value={idp.issuer ?? ''}
                onChange={event =>
                  setIdp(current => ({ ...current, issuer: event.target.value }))
                }
              />
              <Input
                placeholder="Client ID"
                value={idp.clientId ?? ''}
                onChange={event =>
                  setIdp(current => ({ ...current, clientId: event.target.value }))
                }
              />
              <Input
                placeholder="Client secret"
                type="password"
                value={clientSecret}
                onChange={event => setClientSecret(event.target.value)}
              />
              <Input
                placeholder="SAML SSO URL"
                value={idp.ssoUrl ?? ''}
                onChange={event =>
                  setIdp(current => ({ ...current, ssoUrl: event.target.value }))
                }
              />
              <Input
                placeholder="Certificate"
                value={certificate}
                onChange={event => setCertificate(event.target.value)}
              />
              <Button
                onClick={() =>
                  adminGql(
                    `mutation UpsertOrganizationIdp($input: OrganizationIdpInput!) {
                      upsertOrganizationIdp(input: $input) { id kind enabled configured }
                    }`,
                    {
                      input: {
                        kind: idp.kind,
                        enabled: idp.enabled,
                        issuer: idp.issuer || null,
                        clientId: idp.clientId || null,
                        clientSecret: clientSecret || null,
                        ssoUrl: idp.ssoUrl || null,
                        entityId: idp.entityId || null,
                        certificate: certificate || null,
                        groupClaim: idp.groupClaim || 'groups',
                      },
                    }
                  )
                    .then(() => {
                      setClientSecret('');
                      setCertificate('');
                      toast.success(t.t('com.affine.admin.security.saved'));
                      return load();
                    })
                    .catch(error => toast.error((error as Error).message))
                }
              >
                {t.t('com.affine.admin.security.sso.save')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.t('com.affine.admin.security.scim.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {revealedToken ? (
                <p className="rounded-lg border bg-muted p-3 text-sm">
                  {t.t('com.affine.admin.security.scim.token.once')}
                  <code className="mt-2 block break-all">{revealedToken}</code>
                </p>
              ) : null}
              {tokens.map(token => (
                <div
                  key={token.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span>{token.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      adminGql(
                        `mutation RevokeScimToken($id: String!) {
                          revokeScimToken(id: $id)
                        }`,
                        { id: token.id }
                      )
                        .then(load)
                        .catch(error => toast.error((error as Error).message))
                    }
                  >
                    {t.t('com.affine.admin.security.scim.revoke')}
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={tokenName}
                  onChange={event => setTokenName(event.target.value)}
                />
                <Button
                  onClick={() =>
                    adminGql<{ createScimToken: ScimToken }>(
                      `mutation CreateScimToken($name: String!) {
                        createScimToken(name: $name) { id name token }
                      }`,
                      { name: tokenName }
                    )
                      .then(data => {
                        setRevealedToken(data.createScimToken.token ?? null);
                        return load();
                      })
                      .catch(error => toast.error((error as Error).message))
                  }
                >
                  {t.t('com.affine.admin.security.scim.create')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t.t('com.affine.admin.security.policy.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex items-center justify-between gap-4">
                <span>{t.t('com.affine.admin.security.policy.sso')}</span>
                <Switch
                  checked={policy?.requireSso ?? false}
                  onCheckedChange={checked =>
                    setPolicy(current =>
                      current ? { ...current, requireSso: checked } : current
                    )
                  }
                />
              </label>
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.policy.ssoDomains')}</Label>
                <Input
                  value={ssoDomains}
                  onChange={event => setSsoDomains(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>
                  {t.t('com.affine.admin.security.policy.guestDomains')}
                </Label>
                <Input
                  value={guestDomains}
                  onChange={event => setGuestDomains(event.target.value)}
                />
              </div>
              <label className="flex items-center justify-between gap-4">
                <span>{t.t('com.affine.admin.security.policy.blockPublic')}</span>
                <Switch
                  checked={policy?.blockPublicLinks ?? false}
                  onCheckedChange={checked =>
                    setPolicy(current =>
                      current
                        ? { ...current, blockPublicLinks: checked }
                        : current
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>{t.t('com.affine.admin.security.policy.blockEdit')}</span>
                <Switch
                  checked={policy?.blockPublicEditLinks ?? false}
                  onCheckedChange={checked =>
                    setPolicy(current =>
                      current
                        ? { ...current, blockPublicEditLinks: checked }
                        : current
                    )
                  }
                />
              </label>
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.policy.idle')}</Label>
                <Input
                  type="number"
                  value={policy?.sessionIdleSec ?? ''}
                  onChange={event =>
                    setPolicy(current =>
                      current
                        ? {
                            ...current,
                            sessionIdleSec: event.target.value
                              ? Number(event.target.value)
                              : null,
                          }
                        : current
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.policy.max')}</Label>
                <Input
                  type="number"
                  value={policy?.sessionMaxDurationSec ?? ''}
                  onChange={event =>
                    setPolicy(current =>
                      current
                        ? {
                            ...current,
                            sessionMaxDurationSec: event.target.value
                              ? Number(event.target.value)
                              : null,
                          }
                        : current
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.t('com.affine.admin.security.policy.ip')}</Label>
                <Input
                  value={ipAllowlist}
                  onChange={event => setIpAllowlist(event.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  savePolicy().catch(error =>
                    toast.error((error as Error).message)
                  )
                }
              >
                {t.t('com.affine.admin.security.save')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

export { SecurityPage as Component };
