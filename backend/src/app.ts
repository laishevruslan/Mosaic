import { randomUUID } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { existsSync } from 'node:fs';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { AnalyticsService } from './application/analytics-service.js';
import { CaptchaService } from './application/captcha-service.js';
import { IndexerService } from './application/indexer-service.js';
import { AdminUserService } from './application/admin-user-service.js';
import { AiGatewayService } from './application/ai-gateway.js';
import { ApiTokenService } from './application/api-token-service.js';
import { ByokService } from './application/byok-service.js';
import { CalendarService } from './application/calendar-service.js';
import { EmbeddingService } from './application/embedding-service.js';
import { GdprService } from './application/gdpr-service.js';
import { GuardService } from './application/guard-service.js';
import { DlpService } from './application/dlp-service.js';
import { McpService } from './application/mcp-service.js';
import { AppConfigService } from './application/app-config-service.js';
import { AuditService } from './application/audit-service.js';
import { AuthService, type AuthExtras } from './application/auth-service.js';
import { BlobService } from './application/blob-service.js';
import { CommentService } from './application/comment-service.js';
import { DocService } from './application/doc-service.js';
import { HealthService } from './application/health-service.js';
import { JiraService } from './application/jira-service.js';
import { MailService } from './application/mail-service.js';
import { MembershipService } from './application/membership-service.js';
import { MfaService } from './application/mfa-service.js';
import { NotificationService } from './application/notification-service.js';
import { OrgService } from './application/org-service.js';
import { DiscoveryOidcClient } from './application/oidc-client.js';
import { createArgon2Hasher } from './application/password-hasher.js';
import { ScimService } from './application/scim-service.js';
import { SearchService } from './application/search-service.js';
import { SecurityPolicyService } from './application/security-policy-service.js';
import { ShareService } from './application/share-service.js';
import { SigningKeyService } from './application/signing-key-service.js';
import { SsoService } from './application/sso-service.js';
import { WebhookService } from './application/webhook-service.js';
import { WorkspaceService } from './application/workspace-service.js';
import { createBlobObjects } from './adapters/blobs/store.js';
import { authRoutes } from './adapters/http/auth-routes.js';
import { blobRoutes } from './adapters/http/blob-routes.js';
import { docRoutes } from './adapters/http/doc-routes.js';
import { registerErrorHandler } from './adapters/http/error-handler.js';
import './adapters/http/fastify-types.js';
import { graphqlPlugin } from './adapters/http/graphql-plugin.js';
import { healthRoutes } from './adapters/http/health-routes.js';
import { infoRoutes } from './adapters/http/info-routes.js';
import { metricsRoutes } from './adapters/http/metrics-routes.js';
import { apiV2Routes } from './adapters/http/api-v2-routes.js';
import { mcpRoutes } from './adapters/http/mcp-routes.js';
import { mfaRoutes } from './adapters/http/mfa-routes.js';
import { scimRoutes } from './adapters/http/scim-routes.js';
import { observabilityPlugin } from './adapters/http/observability-plugin.js';
import { platformRoutes } from './adapters/http/platform-routes.js';
import { securityHeadersPlugin } from './adapters/http/security-headers.js';
import { sessionPlugin } from './adapters/http/session-plugin.js';
import { setupRoutes } from './adapters/http/setup-routes.js';
import { staticPlugin } from './adapters/http/static-plugin.js';
import type { JobHandler } from './adapters/jobs/worker.js';
import { JobWorker } from './adapters/jobs/worker.js';
import { createMailer } from './adapters/mail/smtp.js';
import { createLogger } from './adapters/observability/logger.js';
import { createMetrics } from './adapters/observability/metrics.js';
import { TracingSkeleton } from './adapters/observability/tracing.js';
import { OpenSearchIndex } from './adapters/search/opensearch-index.js';
import { createStore } from './adapters/persistence/store.js';
import { connectRedis } from './adapters/redis/client.js';
import { socketPlugin } from './adapters/realtime/socket-plugin.js';
import { SocketRealtimeHub } from './adapters/realtime/hub.js';
import type { AppConfig } from './config/env.js';
import { isSpaceType } from './domain/doc.js';
import { errors } from './domain/errors.js';
import type {
  DnsResolver,
  HttpFetcher,
  MailPort,
  RedisPort,
} from './domain/ports.js';
import type { OauthProviderName } from './domain/sso.js';
import type { AiSettings } from './application/ai-gateway.js';
import type { JiraSettings } from './application/jira-service.js';
import type { OidcSettings } from './application/oidc-client.js';
import type { SamlSettings } from './application/sso-service.js';

export interface AppDeps {
  fetch?: HttpFetcher;
  mailer?: MailPort;
  redis?: RedisPort | null;
  dns?: DnsResolver;
}

export async function buildApp(config: AppConfig, deps: AppDeps = {}) {
  const fetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const logger = createLogger(config);
  const store = await createStore(config);
  const clock = { now: () => new Date() };
  const hasher = createArgon2Hasher();

  let redis: RedisPort | null = deps.redis ?? null;
  if (redis === undefined || redis === null) {
    if (deps.redis === null) {
      redis = null;
    } else if (config.REDIS_URL) {
      try {
        redis = await connectRedis(config.REDIS_URL);
      } catch (error) {
        if (config.NODE_ENV === 'production') {
          logger.error({ err: error }, 'redis_connect_failed');
        }
        redis = null;
      }
    }
  }

  const jobHandlers: Record<string, JobHandler> = {};
  const jobs = new JobWorker(store, clock, jobHandlers, {
    pollMs: config.JOB_POLL_MS,
    concurrency: config.JOB_CONCURRENCY,
    inline: config.NODE_ENV === 'test',
  });
  const mailer =
    deps.mailer ??
    createMailer({
      ...(config.SMTP_HOST ? { host: config.SMTP_HOST } : {}),
      port: config.SMTP_PORT,
      ...(config.SMTP_USER ? { user: config.SMTP_USER } : {}),
      ...(config.SMTP_PASSWORD ? { password: config.SMTP_PASSWORD } : {}),
      ...(config.SMTP_FROM ? { from: config.SMTP_FROM } : {}),
      secure: config.smtpSecure,
      ignoreTls: config.smtpIgnoreTls,
      nodeEnv: config.NODE_ENV,
    });
  const mail = new MailService(
    store,
    store,
    mailer,
    clock,
    jobs,
    config.MOSAIC_PUBLIC_URL
  );
  const appConfig = new AppConfigService(config, store, {
    smtpConfigured: () => mail.configured,
    redisConfigured: Boolean(redis),
    aiConfigured: Boolean(config.MOSAIC_AI_API_KEY),
    blobDriver: config.BLOB_DRIVER ?? (config.NODE_ENV === 'test' ? 'memory' : 'fs'),
  });
  const audit = new AuditService(
    store,
    clock,
    fetch,
    config.MOSAIC_SIEM_WEBHOOK_URL,
    config.AUDIT_RETENTION_DAYS
  );
  const dnsResolver: DnsResolver = deps.dns ?? {
    resolveTxt: hostname => dns.resolveTxt(hostname),
  };
  const orgs = new OrgService(store, store, clock, dnsResolver, audit);
  const policy = new SecurityPolicyService(store, clock, async domain =>
    Boolean(await orgs.findVerifiedDomain(domain))
  );
  const authExtras: AuthExtras = {
    audit,
    oauth: store,
    policy,
  };
  const auth = new AuthService(
    store,
    hasher,
    clock,
    {
      allowSignup: config.allowSignup,
      passwordMinLength: config.PASSWORD_MIN_LENGTH,
      passwordMaxLength: config.PASSWORD_MAX_LENGTH,
      idleTtlMs: config.SESSION_IDLE_MS,
      absoluteTtlMs: config.SESSION_ABSOLUTE_MS,
      accessTtlMs: config.ACCESS_TOKEN_MS,
      refreshTtlMs: config.REFRESH_TOKEN_MS,
      exchangeTtlMs: 2 * 60 * 1000,
    },
    authExtras
  );
  const mfa = new MfaService(
    store,
    clock,
    config.MOSAIC_SERVER_NAME,
    auth,
    orgs,
    audit
  );
  authExtras.mfa = {
    requiredForPassword: user => mfa.requiredForPassword(user),
    createLoginChallenge: user => mfa.createLoginChallenge(user),
    methodsFor: async user => {
      const status = await mfa.status(user);
      return { totp: status.totp, passkeyCount: status.passkeyCount };
    },
  };
  authExtras.orgs = orgs;
  const oidcSettings: OidcSettings = {};
  if (config.MOSAIC_OIDC_ISSUER)
    oidcSettings.issuer = config.MOSAIC_OIDC_ISSUER;
  if (config.MOSAIC_OIDC_CLIENT_ID)
    oidcSettings.clientId = config.MOSAIC_OIDC_CLIENT_ID;
  if (config.MOSAIC_OIDC_CLIENT_SECRET)
    oidcSettings.clientSecret = config.MOSAIC_OIDC_CLIENT_SECRET;
  if (config.MOSAIC_OIDC_PROVIDER) {
    oidcSettings.providerLabel =
      config.MOSAIC_OIDC_PROVIDER as OauthProviderName;
  }
  const oidc = new DiscoveryOidcClient(oidcSettings, fetch);
  const saml: SamlSettings = {};
  if (config.MOSAIC_SAML_IDP_SSO_URL)
    saml.ssoUrl = config.MOSAIC_SAML_IDP_SSO_URL;
  if (config.MOSAIC_SAML_IDP_ENTITY_ID)
    saml.entityId = config.MOSAIC_SAML_IDP_ENTITY_ID;
  if (config.MOSAIC_SAML_CERTIFICATE)
    saml.certificate = config.MOSAIC_SAML_CERTIFICATE;
  const sso = new SsoService(
    auth,
    oidc,
    saml,
    config.MOSAIC_PUBLIC_URL,
    clock,
    orgs
  );
  authExtras.oauthProviders = () => sso.oauthProviders();
  const objects = createBlobObjects({
    ...(config.BLOB_DRIVER ? { driver: config.BLOB_DRIVER } : {}),
    dir: config.BLOB_DIR,
    nodeEnv: config.NODE_ENV,
    s3: {
      ...(config.S3_BUCKET ? { bucket: config.S3_BUCKET } : {}),
      region: config.S3_REGION,
      ...(config.S3_ACCESS_KEY_ID
        ? { accessKeyId: config.S3_ACCESS_KEY_ID }
        : {}),
      ...(config.S3_SECRET_ACCESS_KEY
        ? { secretAccessKey: config.S3_SECRET_ACCESS_KEY }
        : {}),
      ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
      forcePathStyle: config.s3ForcePathStyle,
      ...(config.S3_SSE ? { sse: config.S3_SSE } : {}),
      ...(config.S3_KMS_KEY_ID ? { kmsKeyId: config.S3_KMS_KEY_ID } : {}),
    },
    ...(config.GCS_BUCKET ? { gcsBucket: config.GCS_BUCKET } : {}),
    ...(config.GCS_KMS_KEY_NAME
      ? { gcsKmsKeyName: config.GCS_KMS_KEY_NAME }
      : {}),
  });
  const blobs = new BlobService(store, store, objects, clock, {
    maxBytes: config.BLOB_MAX_BYTES,
    storageQuota: config.BLOB_STORAGE_QUOTA_BYTES,
    multipartThreshold: config.BLOB_MULTIPART_THRESHOLD,
    partSize: config.BLOB_PART_SIZE,
    uploadTtlMs: config.BLOB_UPLOAD_TTL_MS,
  });
  const workspaces = new WorkspaceService(store, clock, blobs, audit, orgs);
  const scim = new ScimService(store, store, clock, orgs, auth, audit);
  const adminUsers = new AdminUserService(store, hasher, clock, auth, {
    passwordMin: config.PASSWORD_MIN_LENGTH,
    passwordMax: config.PASSWORD_MAX_LENGTH,
    audit,
  });
  const signingKeys = new SigningKeyService(store, clock, audit);
  const ioBox: { current: import('socket.io').Server | undefined } = {
    current: undefined,
  };
  const hub = new SocketRealtimeHub(() => ioBox.current);
  const notifications = new NotificationService(
    store,
    store,
    store,
    clock,
    hub
  );
  const webhooks = new WebhookService(
    workspaces,
    store,
    clock,
    fetch,
    audit,
    jobs
  );
  const members = new MembershipService(
    workspaces,
    store,
    store,
    store,
    clock,
    config.MOSAIC_PUBLIC_URL,
    hub,
    { audit, policy, webhooks, notifications, mail }
  );
  const shares = new ShareService(workspaces, store, store, clock, hub, {
    audit,
    policy,
    webhooks,
  });
  const comments = new CommentService(workspaces, store, store, clock, hub, {
    webhooks,
  });
  const docs = new DocService(store, store, clock, {
    compactUpdateCount: config.SYNC_COMPACT_UPDATES,
    maxUpdateBytes: config.SYNC_MAX_UPDATE_BYTES,
    historyLimit: config.DOC_HISTORY_LIMIT,
  });
  const dlp = new DlpService(config.MOSAIC_DLP_MODE ?? 'off', { audit });
  blobs.bindDlp(dlp);
  const guard = new GuardService(store, workspaces, clock, {
    audit,
    shares: store,
    ...(config.MOSAIC_CONFIDENTIAL_BLOCKS_PUBLIC === false
      ? { confidentialBlocksPublic: false }
      : {}),
  });
  shares.bindGuard(guard);
  blobs.bindGuard(guard);
  docs.bindGuard(guard);
  workspaces.bindGuard(guard);
  const search = new SearchService(store, store);
  const embeddings = new EmbeddingService(
    store,
    store,
    store,
    clock,
    workspaces,
    jobs,
    audit
  );
  const byok = new ByokService(store, workspaces, clock, audit);
  const mcp = new McpService(
    store,
    store,
    search,
    workspaces,
    clock,
    config.MOSAIC_PUBLIC_URL,
    Boolean(config.MOSAIC_MCP_WRITE_ENABLED),
    audit
  );
  const calendar = new CalendarService(
    store,
    workspaces,
    clock,
    config.MOSAIC_PUBLIC_URL,
    audit
  );
  const tokens = new ApiTokenService(store, clock, audit);
  const gdpr = new GdprService(
    store,
    workspaces,
    store,
    store,
    store,
    store,
    store,
    auth,
    guard,
    clock,
    { audit }
  );
  const aiSettings: AiSettings = {
    baseUrl: config.MOSAIC_AI_BASE_URL,
    model: config.MOSAIC_AI_MODEL,
    quotaLimit: config.MOSAIC_AI_QUOTA_TOKENS ?? null,
  };
  if (config.MOSAIC_AI_API_KEY) {
    aiSettings.apiKey = config.MOSAIC_AI_API_KEY;
  }
  const ai = new AiGatewayService(
    store,
    clock,
    aiSettings,
    fetch,
    audit,
    workspaces,
    embeddings,
    byok,
    jobs,
    dlp
  );
  const jiraSettings: JiraSettings = {};
  if (config.MOSAIC_JIRA_BASE_URL)
    jiraSettings.baseUrl = config.MOSAIC_JIRA_BASE_URL;
  if (config.MOSAIC_JIRA_EMAIL) jiraSettings.email = config.MOSAIC_JIRA_EMAIL;
  if (config.MOSAIC_JIRA_API_TOKEN)
    jiraSettings.apiToken = config.MOSAIC_JIRA_API_TOKEN;
  const jira = new JiraService(jiraSettings, fetch);
  const health = new HealthService(config, store, redis);

  jobHandlers['mail.send'] = async payload => {
    const outboxId = payload.outboxId;
    if (typeof outboxId === 'string') {
      await mail.deliver(outboxId);
    }
  };
  jobHandlers['webhook.retry'] = async payload => {
    const url = payload.url;
    const secret = payload.secret;
    const event = payload.event;
    const body = payload.body;
    if (
      typeof url === 'string' &&
      typeof secret === 'string' &&
      typeof event === 'string' &&
      typeof body === 'string'
    ) {
      await webhooks.retryDelivery({ url, secret, event, body });
    }
  };
  jobHandlers['blob.gc'] = async () => {
    await blobs.gcAll();
  };
  jobHandlers['doc.compact'] = async payload => {
    const spaceType = payload.spaceType;
    const spaceId = payload.spaceId;
    const docId = payload.docId;
    if (
      typeof spaceType === 'string' &&
      isSpaceType(spaceType) &&
      typeof spaceId === 'string' &&
      typeof docId === 'string'
    ) {
      await docs.compact(spaceType, spaceId, docId);
    }
  };
  jobHandlers['index.document'] = async () => {
    // Replaced after IndexerService is constructed (needs metrics registry).
  };
  jobHandlers['embed.document'] = async payload => {
    await embeddings.handleEmbedJob(payload);
  };
  jobHandlers['copilot.transcript'] = async payload => {
    await ai.handleTranscriptJob(payload);
  };
  jobHandlers['calendar.sync'] = async payload => {
    await calendar.handleSyncJob(payload);
  };
  jobHandlers['audit.purge'] = async () => {
    // Retention filter is already applied on read; partition drop is E0.
  };
  jobs.start();

  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    genReqId: req => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.length > 0) {
        return incoming;
      }
      return randomUUID();
    },
  });

  const metrics = createMetrics(config.OTEL_SERVICE_NAME, {
    collectProcessMetrics: config.NODE_ENV !== 'test',
  });
  const captcha = new CaptchaService(
    `${config.MOSAIC_SERVER_NAME}:captcha`,
    config.MOSAIC_CAPTCHA_ENABLED === true
  );
  const analytics = new AnalyticsService(
    store,
    store,
    store,
    store,
    store,
    store,
    clock,
    config.MOSAIC_PUBLIC_URL
  );
  const remoteIndex =
    config.MOSAIC_INDEXER_DRIVER === 'opensearch' && config.OPENSEARCH_URL
      ? new OpenSearchIndex(config.OPENSEARCH_URL, fetch)
      : undefined;
  const indexer = new IndexerService(
    store,
    store,
    store,
    store,
    clock,
    jobs,
    {
      metrics: {
        docsTotal: metrics.indexDocsTotal,
        lagSeconds: metrics.indexLagSeconds,
        searchDuration: metrics.searchDuration,
      },
      ...(remoteIndex ? { remote: remoteIndex } : {}),
    }
  );
  search.bindIndexer(indexer);
  docs.bindIndexer(indexer);
  comments.bindIndexer(indexer);
  jobHandlers['index.document'] = async payload => {
    await indexer.handleIndexJob(payload);
  };
  const tracing = new TracingSkeleton(
    config.OTEL_SERVICE_NAME,
    config.OTEL_EXPORTER_OTLP_ENDPOINT,
    (payload, msg) => {
      app.log.info(payload, msg);
    }
  );

  app.decorate('mosaicAuthRateLimit', config.RATE_LIMIT_AUTH_MAX);
  registerErrorHandler(app as unknown as import('fastify').FastifyInstance);

  await app.register(observabilityPlugin, { metrics, tracing });
  await app.register(securityHeadersPlugin, { hsts: config.cookieSecure });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? config.MOSAIC_PUBLIC_URL : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    allowList: request =>
      request.url === '/metrics' ||
      request.url.startsWith('/health/') ||
      request.url === '/info' ||
      request.url.startsWith('/socket.io'),
    errorResponseBuilder: () => errors.tooManyRequests(),
  });

  const cookies = {
    secure: config.cookieSecure,
    maxAgeSec: Math.floor(config.SESSION_ABSOLUTE_MS / 1000),
  };

  await app.register(sessionPlugin, { auth, policy });
  await app.register(infoRoutes, { health });
  await app.register(healthRoutes, { health });
  await app.register(metricsRoutes, { metrics });
  await app.register(authRoutes, { auth, cookies, sso, captcha });
  await app.register(mfaRoutes, { auth, mfa, cookies });
  await app.register(scimRoutes, { scim });
  await app.register(setupRoutes, { auth, cookies });
  await app.register(graphqlPlugin, {
    auth,
    workspaces,
    members,
    shares,
    comments,
    blobs,
    docs,
    sso,
    search,
    ai,
    audit,
    policy,
    notifications,
    mail,
    appConfig,
    adminUsers,
    orgs,
    scim,
    signingKeys,
    store,
    config,
    embeddings,
    byok,
    mcp,
    calendar,
    guard,
    gdpr,
    analytics,
  });
  await app.register(mcpRoutes, { auth, workspaces, mcp });
  await app.register(apiV2Routes, {
    auth,
    workspaces,
    tokens,
    publicUrl: config.MOSAIC_PUBLIC_URL,
  });
  await app.register(docRoutes, { auth, docs, shares, analytics });
  await app.register(blobRoutes, { auth, blobs });
  await app.register(platformRoutes, {
    auth,
    workspaces,
    audit,
    webhooks,
    ai,
    embeddings,
    jira,
    indexer,
    ...(config.MOSAIC_JIRA_WEBHOOK_SECRET
      ? { jiraWebhookSecret: config.MOSAIC_JIRA_WEBHOOK_SECRET }
      : {}),
  });
  await app.register(socketPlugin, {
    auth,
    docs,
    members,
    shares,
    comments,
    blobs,
    notifications,
    embeddings,
    ...(redis ? { redis } : {}),
    config,
    metrics,
  });
  ioBox.current = app.mosaicIo;

  if (config.MOSAIC_STATIC_DIR) {
    if (!existsSync(config.MOSAIC_STATIC_DIR)) {
      if (config.NODE_ENV === 'production') {
        throw new Error(
          `MOSAIC_STATIC_DIR does not exist: ${config.MOSAIC_STATIC_DIR}`
        );
      }
      app.log.warn(
        { dir: config.MOSAIC_STATIC_DIR },
        'mosaic_static_dir_missing'
      );
    } else {
      await app.register(staticPlugin, { dir: config.MOSAIC_STATIC_DIR });
    }
  }

  app.addHook('onClose', async () => {
    await jobs.stop();
    await tracing.close();
    await redis?.close();
    await objects.close();
    await store.close();
  });

  return {
    app,
    health,
    store,
    auth,
    workspaces,
    members,
    shares,
    comments,
    docs,
    blobs,
    sso,
    search,
    ai,
    audit,
    policy,
    webhooks,
    jira,
    notifications,
    mail,
    jobs,
    appConfig,
    orgs,
    scim,
    mfa,
    adminUsers,
    guard,
    gdpr,
  };
}

export type BuiltApp = Awaited<ReturnType<typeof buildApp>>;
