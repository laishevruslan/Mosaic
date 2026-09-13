# План: Mosaic Enterprise

Дата: 2026-09-12  
Связанные документы: `plans/clean_room_backend_plan.md` (выполнен), `plans/enterprise_readiness_plan.md` (устарел: целился в EE Nest), `plans/miro_kanban_parity_plan.md`, `plans/miro_whiteboard_implementation_plan.md`, `plans/mosaic_workshop_chrome_plan.md` (edgeless chrome + sticky/frame/card/tag + `mosaic.board` фасад)  
Цель: довести Mosaic (MIT-клиент + clean-room `backend/` / `@mosaic/server`) до уровня, на котором продукт проходит enterprise security review, держит production HA, закрывает RFP против Miro / Mural / Figma / Lucid **и** продаётся как cloud (Stripe) / self-host (license + seats) с полным GraphQL, Copilot/MCP/embeddings, indexer и admin analytics — **не копируя** `packages/backend/**`.

---

## 0. Короткий вывод

Clean-room сервер закрыл **self-host MVP**: auth, workspaces, Yjs sync, blobs, members/share/comments, cutover без EE в runtime-образе, плюс platform-slice (OIDC/SAML ACS, audit table, security policy, query-time search, BYOK chat, HMAC webhooks, Jira REST). Это фундамент, не enterprise-продукт.

Разрыв с Miro Enterprise Guard / Mural Enterprise / Figma Governance+ / Lucid Shield — **не в канвасе-примитивах**, а вокруг него:

1. **Identity gate** — SCIM, MFA/WebAuthn, domain-enforced SSO, session/IP policy, JIT provisioning. Без этого сделки не закрываются.
2. **Governance UI + compliance** — admin console на Mosaic API (сейчас `appConfig` = stub), SIEM-grade audit, retention/legal hold, GDPR/DSAR, sensitivity labels.
3. **Production platform** — Redis fan-out, S3, job queue, SMTP, OTLP, backups, K8s. Compose с Postgres/Redis есть, но адаптеры ещё не подключены.
4. **Workshop product** — facilitation, Kanban Format, canvas AI, Slack/Teams, публичный SDK.
5. **A11y / mobile / search по объектам доски** — юридические и RFP-требования.
6. **AI platform** — не один BYOK chat: Copilot-сессии/стрим, MCP credentials, embeddings + RAG, AI Gateway с квотами и маршрутизацией моделей.
7. **Commercial** — Stripe (cloud), license keys (self-host), seat enforcement на wire `quota.memberLimit` / `inviteMembers`.
8. **Полный GraphQL** — клиент бьёт ~180 operations; сейчас живёт срез + stubs. Enterprise = закрыть матрицу без «UI падает / пустые экраны».

Рекомендация: вести **шесть параллельных треков** (Identity+Admin, Platform HA, Facilitation+Kanban, AI+Search, Commercial, Integrations+Guard). Канвас-архитектуру (`wb:*`, LOD, awareness `wbCollab`) не переписывать.

**В scope (раньше сознательно вне MVP):** полноценный GraphQL без `compat.stub`, Copilot / MCP / embeddings, AI Gateway, полный indexer + Search, Notifications, Audit, SSO/SCIM, Stripe + license keys + seat enforcement, Calendar, GCloud-плагины, admin analytics.

**Не цель:** копировать EE-код `packages/backend` (Nest/Prisma/Stripe-модули AFFiNE), строить свой SIEM, ML-DLP в v1, marketplace до SDK слой 1.  
**Цель:** Mosaic Enterprise — self-host (лицензия + seat cap) и managed cloud (Stripe), **свои** биллинг/лицензия/квоты, wire-compat с MIT-клиентом (`@affine/graphql`) + Mosaic-native API v2 рядом.

---

## 1. Что уже закрыто (не повторять)

Источник: `backend/` после Phase 0–6 `clean_room_backend_plan.md`. Статусы ниже — **код**, не UI live (Docker/IdP/два браузера в той среде не гонялись).

| Слой | Есть | Ограничение (переносится в этот план) |
| ---- | ---- | ------------------------------------- |
| Сервер | Fastify + Yoga + Socket.IO, hexagonal `backend/` | Redis/S3/jobs/OTLP — заглушки или skipped |
| Auth | Cookie session, Argon2id, CSRF, rate limit, setup admin | Magic link / SMTP → `emailServiceNotConfigured`; passkey `available: false` |
| SSO | OIDC discovery + JWKS; SAML ACS + XML-DSig | Env-конфиг инстанса, не per-workspace; нет JIT-ролей из групп; нет Google/GitHub/Apple пресетов |
| ACL | Workspace Owner/Admin/Collaborator | Нет полноценного DocRole matrix, External/guest, IP allowlist |
| Sync | Yjs persist + awareness in-process | Нет Redis adapter → один инстанс; compact inline, не очередь |
| Blobs | FS + memory, upload tokens, history | Нет S3; нет malware scan |
| Collab product | Comments GraphQL, public docs | Invites без email; notifications stub `count: 0` |
| Audit | `audit_events` + GraphQL + CSV + опциональный SIEM webhook | Нет партиций, Admin UI, полного каталога событий |
| Policy | `SecurityPolicy` (guest domains, blockPublicLinks, requireSso, sessionMaxDuration) | Нет `blockPublicEditLinks`, idle timeout UI, IP allowlist |
| Search | Query-time по Yjs JSON + comments | Нет инвертированного индекса, `aggregate`, embeddings, виджетов канваса |
| AI | BYOK chat session/message + `POST .../ai/kanban` | Нет streaming, MCP credentials, embeddings/RAG, transcript, BYOK profiles, canvas Sidekick UX |
| Billing | `quota` generous stub; `subscription` / checkout / license — stub | Нет Stripe, license keys, seat lock на invite |
| Notify | `listNotifications` empty; realtime `count: 0` | Нет persist, mention, email fan-out |
| Calendar / GCloud | не маршрутизированы | Клиентные `.gql` есть, сервер молчит |
| Jira | REST search/import/push/pull + inbound webhook | Нет OAuth, status mapping UI, two-way на `wb:board` |
| Admin SPA | Accounts / Settings / About (EE-era) | `appConfig` stub `{}`; `adminDashboard` нет — консоль **не управляет** Mosaic Server |
| Whiteboard | chart / board / sketch + LOD + follow/attention | Flags default **off**; нет timer/vote/laser/private/summon; Kanban Format не начат |

Clean-room policy остаётся: писать по контрактам клиента и публичным спекам, не читать `packages/backend/server` / `native`.

---

## 2. Перенос незакрытого backlog

Всё ниже **не сделано** или сделано как slice/stub. Сгруппировано по источнику, чтобы ничего не потерять.

### 2.1 Из `clean_room_backend_plan.md`

Явно вне MVP / «далее»:

| ID | Пункт | Куда в этом плане |
| -- | ----- | ----------------- |
| CR-1 | SCIM, MFA, admin UI | §5.1, §5.2, фаза E0 |
| CR-2 | Full-text indexer (не query-time) | §5.10, §5.18, фаза E4 |
| CR-3 | Copilot / MCP / embeddings | §5.5, фаза E2 |
| CR-4 | Calendar plugin | §5.19, фаза E2 |
| CR-5 | Payment / Stripe / license keys / seat enforcement | §5.13, фаза E5 — **Mosaic-реализация**, wire-compat с `@affine/graphql`, не копия EE |
| CR-6 | Полный admin analytics (`adminDashboard`) | §5.2, §5.20 |
| CR-20 | GCloud plugins (metrics/logging/storage extras) | §5.19 |
| CR-21 | Полноценный GraphQL (закрыть stubs) | §5.18 |
| CR-7 | S3 blob adapter | §5.14 |
| CR-8 | Redis pub/sub для Socket.IO / awareness | §5.14 |
| CR-9 | BullMQ / pg-boss (compact, GC, mail, webhooks retry) | §5.14 |
| CR-10 | OTLP SDK (сейчас skeleton `traceparent`) | §5.14 |
| CR-11 | Dual-run live E2E + chaos kill-server | §5.15 |
| CR-12 | Mosaic REST/GraphQL v2 рядом с compat | §5.12 |
| CR-13 | SMTP / magic-link / open-app email | §5.3 |
| CR-14 | `appConfig` не stub | §5.2 |
| CR-15 | `GET /api/workspaces/:id/mcp` | §5.5 |
| CR-16 | Health: Redis реально ping (сейчас `skipped`) | §5.14 |
| CR-17 | Postgres RLS / tenant isolation hardening | §5.7 |
| CR-18 | Load smoke 100 concurrent awareness | §5.15 |
| CR-19 | Soak 24h zero data-loss | §5.15 |

### 2.2 Из `enterprise_readiness_plan.md` (переписано на Mosaic Server)

Старый план ссылался на Nest plugins / Prisma / `packages/backend/native`. Реализация — только в `backend/` + MIT frontend.

| ID | Пункт | Статус на 2026-09-12 | Действие |
| -- | ----- | -------------------- | -------- |
| ER-1 | SAML 2.0 | 🟡 ACS + metadata есть | Per-org IdP, пресеты Okta/Entra, enforce по домену |
| ER-2 | SCIM v2 Users/Groups | ❌ | P0, фаза E0 |
| ER-3 | MFA TOTP + WebAuthn | ❌ (`passkey` stub) | P0 |
| ER-4 | Session policy admin | 🟡 поле `sessionMaxDurationSec` | Idle timeout, max concurrent, revoke-all UI |
| ER-5 | IP allowlist | ❌ | P0/P1 |
| ER-6 | Admin Security tab | ❌ | Перевести admin на Mosaic `appConfig` |
| ER-7 | Audit + SIEM | 🟡 таблица + CSV + URL | Каталог 15–20 событий, retention UI, Splunk HEC |
| ER-8 | Guest/domain + public link policy | 🟡 частично | `blockPublicEditLinks`, guest External, approve guests |
| ER-9 | Facilitation | ❌ (есть follow/attention) | §5.4 |
| ER-10 | Canvas AI | 🟡 REST kanban JSON | Chart-from-prompt, stickers→board, summarize |
| ER-11 | Public SDK + webhooks продукт | 🟡 HMAC webhooks | SDK слой 1, события doc/comment/board |
| ER-12 | Slack / Teams | ❌ | §5.6 |
| ER-13 | Jira card linking UI | 🟡 server REST | Привязка к `wb:board` |
| ER-14 | Data residency | 🟡 self-host = регион | Managed topology + docs |
| ER-15 | Retention / legal hold | 🟡 хук blob/doc GC + GraphQL | UI настроек / eDiscovery zip — не E3 |
| ER-16 | BYOK/KMS blobs | 🟡 S3 SSE-KMS headers | Native GCS KMS driver — stub |
| ER-17 | DLP hook | 🟡 `ContentClassifier` regex | Не ML-классификатор |
| ER-18 | Sensitivity labels | 🟡 Public/Internal/Confidential | Org-wide policy UI — позже |
| ER-19 | WCAG 2.2 AA | 🟡 keyboard explore + ARIA | axe Playwright skipped unless `A11Y=1`; VPAT процесс |
| ER-20 | Поиск по объектам канваса | 🟡 FTS writer + extractors | OpenSearch live cluster / p95 10k docs не измерены |
| ER-21 | Mobile edgeless parity | 🟡 conservative LOD | Touch vs widget-DnD и default-on mobile edgeless не делались |
| ER-22 | Marketplace | ❌ | После SDK, P3 |
| ER-23 | Object-level ACL | ❌ сознательно | Не v1; labels вместо этого |

### 2.3 Из `miro_kanban_parity_plan.md` (не начат)

Фазы A–G плана Kanban: A+B+C в коде (E1); Timeline layout — E4 (`wb:board` layout, без data-view preset). AI Sidekick / Jira two-way на виджете — не E4. Флаг `enable_board_widget` default false.

Для enterprise это не «косметика»: воркшоп + Jira Planner — типовой RFP. Переносится как трек **E1-K** (продуктовый паритет Format) параллельно identity.

Обязательный минимум для «команды без Jira»: фазы A+B+C того плана (Format shell, canvas ingest/egress, 14 шаблонов). Timeline/AI/Jira — P1/P2 здесь.

### 2.4 Из `miro_whiteboard_implementation_plan.md` (хвосты)

| ID | Пункт | Действие |
| -- | ----- | -------- |
| WB-1 | Dual-browser Playwright: chart spec + kanban drag + reload | Фаза E5 |
| WB-2 | Публичный `@affine/whiteboard-sdk` слой 1 | §5.6, фазы WC4 `mosaic_workshop_chrome_plan.md` |
| WB-3 | Iframe plugin widgets слой 2 | После слоя 1 |
| WB-4 | Default-on флаги chart/sketch/board/collab после e2e | Фаза E1 |
| WB-5 | Vega-Lite «простой режим» chart | P2 |
| WB-6 | Shared database UX across pages | P2 |
| WB-7 | Board-first скин всего приложения (вариант F) | P3, **не** workshop chrome |
| WC-* | Workshop chrome: rail / sticky / app-card / tokens / panel host | `plans/mosaic_workshop_chrome_plan.md`, фаза E1 |

### 2.5 GraphQL / REST stubs, которые надо закрыть (inventory)

Источник: `packages/common/graphql/src/graphql/**/*.gql` (~180 документов) + `backend/docs/compat-matrix.csv`. Статус `stub` = клиент уже вызывает, сервер отдаёт пустое / `compat.stub` / 403. Enterprise = **реализовать**, не расширять stub.

| Кластер | Документы / поверхность | Сейчас | Целевой блок |
| ------- | ----------------------- | ------ | ------------ |
| Admin config | `admin/config.gql`, `update-config`, `validate-config`, `admin-server-config` | `appConfig` = `{}` | §5.2, §5.18 |
| Admin users | `list-users`, `create-user`, `delete-user`, `disable/enable-user`, `import-users`, `update-account`, `update-account-features`, `get-user-by-email`, `change-password-url` | UI есть, Mosaic API нет | §5.2 |
| Admin analytics | `admin-dashboard.gql` (sync users, copilot conv, storage, top shared links + timelines) | нет | §5.20 |
| Admin ops | `admin-workspaces`, `admin-workspace`, `admin-update-workspace`, `admin-all-shared-links`, `admin-mail-deliveries`, `send-test-email`, auth signing keys | нет / EE-only | §5.2 |
| Billing | `prices`, `subscription`, `subscription-refresh/request`, `createCheckoutSession`, `createCustomerPortal`, `cancel/resume-subscription`, `update-subscription-billing`, `invoices`, `workspace-invoices`, `get-workspace-subscription` | stub / не advertise `Payment` | §5.13 |
| License | `get-license`, `install-license`, `activate/deactivate-license`, `preview-license`, `generate-license-key` | stub | §5.13 |
| Quota / seats | `quota.gql` (`memberLimit`, `storageQuota`, `blobLimit`, `historyPeriod`) | generous stub | §5.13 |
| Copilot core | session CRUD/fork/cleanup, histories, `createCopilotMessage`, quota, route-options | 3 мутации | §5.5 |
| Copilot extras | ignored-docs, artifacts, transcript tasks, workspace BYOK profiles (`workspace-byok-*`), `workspace-enable-ai`, `workspace-enable-doc-embedding` | нет | §5.5 |
| MCP | `mcp-credentials/{create,list,revoke,rotate}.gql`, `GET /api/workspaces/:id/mcp` | stub | §5.5 |
| Indexer | `indexer-search`, `indexer-search-docs`, `indexer-aggregate` | query-time, нет aggregate | §5.10 |
| Notifications | `list-notifications`, `read-notification`, `read-all-notifications`, `mention-user` | empty | §5.3 |
| Calendar | `calendar-events`, `calendar-providers`, `workspace-calendars`, `link-caldav-account`, `update-workspace-calendars` | stub | §5.19 |
| Auth email | `send-verify-email`, `send-change-email`, `send-change-password-email`, `send-set-password-email`, `verify-email`, `change-email`, `change-password` | SMTP нет | §5.3 |

Правило: каждый `.gql` из MIT-клиента либо **implemented** (контрактный тест), либо явно помечен `wontfix` + клиент не рисует битый UI. `compat.stub` в production — дефект.

---

## 3. Новое (не было в старых планах)

То, без чего «enterprise» в 2026 не продаётся, даже если закрыть старый backlog.

| ID | Функция | Зачем | Приоритет |
| -- | ------- | ----- | --------- |
| N-1 | **Organization** как граница выше workspace (SSO/SCIM/billing/audit scope) | У конкурентов IdP цепляется к org, не к каждой доске | P0 |
| N-2 | JIT provisioning + group→role map из SAML/OIDC claims | SCIM без JIT всё равно оставляет ручные дыры | P0 |
| N-3 | API tokens (personal + org) + Mosaic REST v2 | Автоматизация, Zapier, internal tools | P0/P1 |
| N-4 | In-app + email notifications (invite, mention, comment, due) | Сейчас `notification.count.get` = 0 | P0 |
| N-5 | Break-glass admin / support impersonation с audit | Enterprise support без шаринга паролей | P1 |
| N-6 | Backup / PITR / documented RPO-RTO | Self-host RFP | P0 |
| N-7 | Helm chart + HPA + anti-affinity (stateless app) | Managed/K8s customers | P1 |
| N-8 | Blob malware/content sniff + CSP/security headers | Upload = атака | P1 |
| N-9 | GDPR: export user, delete user (DSAR), cookie/consent для cloud | 🟡 `exportMyData` / `deleteAccount` в E3; cookie/consent cloud нет | P1 |
| N-10 | Secrets via env/file, не в GraphQL `appConfig` plaintext | Admin EE-паттерн опасен | P0 |
| N-11 | Feature-flag remote config с admin | Раскатка enterprise-фич | P1 |
| N-12 | Org usage meter (storage, seats, AI tokens) + Stripe/license | Своя коммерция, wire `quota`/`prices` | P0 |
| N-25 | AI Gateway: маршруты моделей, BYOK per-workspace, rate/quota, audit каждого вызова | Не один env-ключ на процесс | P0 |
| N-26 | Embeddings pipeline + `CopilotEmbedding` feature | RAG по доске/докам | P1 |
| N-27 | MCP credentials + stdio/HTTP tools (`search`, `read_document`, write later) | IDE/агенты | P1 |
| N-28 | `adminDashboard` метрики из audit + prometheus + blob sizes | 🟡 GraphQL rollups | `syncActiveUsers` без Redis presence = 0 |
| N-29 | GCloud plugin-адаптеры: Cloud Logging, Cloud Monitoring, GCS как S3 | Managed GCP | P2 |
| N-30 | Seat enforcement на `inviteMembers` / `acceptInvite` / SCIM | Иначе биллинг бессмысленен | P0 |
| N-13 | Idle session + device inventory UI (сессии уже в модели) | Security questionnaire | P0 |
| N-14 | Domain verification (DNS TXT) перед SSO enforce | Иначе захват домена | P0 |
| N-15 | Webhook delivery queue + retries + dead letter | Сейчас sync HTTP | P1 |
| N-16 | Postgres logical backup job + blob versioning | DR | P1 |
| N-17 | Status/SLO dashboard (sync p95, error budget) | Ops | P1 |
| N-18 | Captcha optional (сейчас 403) для публичного signup | 🟡 HMAC challenge, default off | Не Turnstile/hCaptcha |
| N-19 | VirusTotal-class optional scanner hook на blob complete | Финсектор | P2 |
| N-20 | Customer success: org templates / blueprints | Onboarding | P2 |
| N-21 | OpenAPI для REST v2 + changelog compat | Developer platform | P1 |
| N-22 | eDiscovery export (zip docs+audit+comments по запросу legal) | Guard add-on | P2 |
| N-23 | Intune/MAM notes для mobile (политика, не код) | Mural-parity docs | P2 |
| N-24 | Passwordless magic link после SMTP | UX + IdP fallback | P1 |

---

## 4. Целевая архитектура

### 4.1 Принципы

1. **Org → Workspace → Doc.** Org владеет IdP, SCIM, retention, billing. Workspace — коллаборация. Doc — CRDT + ACL.
2. **Сервер — source of truth для identity/governance; CRDT — для содержимого доски.** Policy (share, SSO, SCIM deprovision) проверяется на каждом REST/WS/GraphQL, не «спрятать в React».
3. **Deprovision = revoke sessions + membership + future join.** Уволенный через SCIM не должен пушить updates.
4. **Jobs для всего, что не request-path:** compact, blob GC, mail, webhook retry, search index, audit purge.
5. **Multi-instance с дня HA:** Socket.IO Redis adapter, sticky sessions не как единственная стратегия.
6. **Secrets вне БД UI:** SMTP/OIDC/SAML cert/KMS ARN — env или sealed secret; admin показывает «configured: true».
7. **Compat GraphQL v1 закрывается полностью** (не вечный stub-слой). Mosaic-native `/api/v2` — рядом, не вместо. Новые enterprise-поля аддитивны; `ServerFeature.Payment` / `Copilot` / `CopilotEmbedding` / `Indexer` advertise только когда реализация живая.
8. **Observability first:** trace id уже есть; добавить OTLP, RED-метрики sync, audit of admin actions, dashboard из тех же метрик.
9. **Clean-room** не ослабляется. Новый код только в `backend/` и MIT frontend packages. Stripe/license писать по публичному Stripe API + наблюдаемым `.gql`, не по Nest-плагину AFFiNE.
10. **Feature flags:** server `MOSAIC_FEATURES` + client flags; enterprise-фичи default off до e2e.
11. **Seat/quota — серверная правда.** Клиентский `memberLimit` нельзя обойти GraphQL; SCIM/invite/push проверяют один `QuotaService`.
12. **AI Gateway — единственная точка к LLM.** Copilot, canvas generate, embeddings, MCP tools не ходят в провайдера в обход gateway (квота, ключ, audit, redaction).

### 4.2 Логические сервисы (эволюция диаграммы clean-room)

```
                    MIT Client + Admin + nbstore
                     GraphQL v1 (полный) / REST / Socket.IO / Admin SPA
                                        │
                              API Gateway (compat + v2)
                                        │
     ┌──────────┬──────────┬──────────┬─────┴──────┬──────────┬──────────┬──────────┐
     ▼          ▼          ▼          ▼            ▼          ▼          ▼          ▼
 Identity    Org Policy  Doc Sync   Blob+KMS    Indexer    AI Gateway  Billing    Jobs
 Org/SCIM    Audit/DLP   Redis      S3/GCS      FTS+vec    Copilot/MCP Stripe     Mail/WH
 MFA/SSO     Notify      fanout                 embed      Embeddings  License    Calendar
     └──────────┴──────────┴──────────┴────────────┴──────────┴──────────┴──────────┘
                                        │
                         PostgreSQL (RLS optional) + Redis
```

Новые bounded contexts: **Organization**, **Directory (SCIM)**, **Notify**, **Index**, **Guard**, **AiGateway**, **Billing** (Stripe+license+quota), **Calendar**. Резать GraphQL по файлам контекстов (`graphql-platform.ts`, `graphql-billing.ts`, `graphql-copilot.ts`, `graphql-admin.ts`, …).

### 4.3 Модель данных (добавки)

Поверх существующих таблиц (`users`, `sessions`, `workspaces`, `audit_events`, `workspace_security_policies`, …):

**Org:** `organizations`, `organization_members`, `organization_domains` (verified), `organization_idp` (OIDC/SAML per org)  
**Directory:** `scim_tokens`, `scim_users` (externalId), `scim_groups`  
**MFA:** `user_totp`, `webauthn_credentials`, `recovery_codes`  
**Tokens:** `api_tokens` (hash, scopes, org/user, last_used)  
**Notify:** `notifications`, `notification_prefs`, `outbox_emails`  
**Guard:** `sensitivity_labels`, `retention_policies`, `legal_holds`  
**Index:** `search_documents` (tsvector + optional pgvector), `embedding_chunks`, `index_jobs`  
**AI:** `copilot_sessions/messages` (уже), `copilot_ignored_docs`, `copilot_artifacts`, `transcript_tasks`, `workspace_byok_profiles`, `mcp_credentials`, `ai_usage_events`  
**Billing:** `plans`, `subscriptions`, `invoices`, `license_keys`, `seat_grants`, `stripe_events` (idempotent webhook)  
**Calendar:** `calendar_accounts`, `calendar_subscriptions`, `calendar_events_cache`  
**Jobs:** `job_queue` или BullMQ Redis  
**Audit:** партиции по месяцу; `audit_retention_days` на org; события биллинга/AI/SCIM  

Не копировать Prisma EE schema. Stripe Customer/Subscription id хранить как opaque strings.

---

## 5. Функциональные блоки

### 5.1 [P0] Identity: Org + SCIM + MFA + SSO-enforce

**Проблема.** OIDC/SAML логинят пользователя, но нет directory sync, нет TOTP/passkey, нет verified-domain «SSO only», нет org.

**Работы.**

1. Organization: создать org при setup; workspaces принадлежат org; instance admin ≠ org admin (self-host single-org ок).
2. Domain verification: DNS TXT `mosaic-domain-verification=<token>`; только после verify — `requireSso`.
3. Per-org IdP: перенести `MOSAIC_OIDC_*` / `MOSAIC_SAML_*` с процесса на `organization_idp` (env остаётся fallback для single-org self-host).
4. JIT: при первом SAML/OIDC — создать user, членство по claim `groups` → WorkspaceRole/OrgRole. Без JIT — только SCIM-созданные.
5. SCIM v2: `GET/POST/PUT/PATCH/DELETE /scim/v2/Users`, `/Groups`; Bearer token из admin; map `active=false` → disable + revoke sessions; Okta + Entra + Google как приёмка.
6. MFA: TOTP RFC 6238; WebAuthn (passkey) на `@simplewebauthn/server`; recovery codes; `preflight.methods.passkey`; enforce MFA org-wide или «MFA if not SSO».
7. Session: idle + absolute уже в `Session`; включить policy из `SecurityPolicy`; IP allowlist CIDR на org; device list UI уже почти совпадает с `/api/auth/sessions`.
8. Audit: `auth.mfa_enroll`, `scim.user.*`, `org.domain_verify`, `auth.impersonate`.

**Точки кода:** `backend/src/application/sso-service.ts`, `auth-service.ts`, `domain/security.ts`, новые `scim-routes.ts`, `mfa-service.ts`. Клиент: sign-in methods, settings security. Admin: §5.2.

**Не делать:** читать `packages/backend/native/.../auth_session`. WebAuthn писать с нуля по spec.

**Оценка.** Org+domain+JIT — 2 недели. SCIM Users+Groups+3 IdP — 4 недели. MFA — 2 недели.

#### Audit (enterprise-grade, не только таблица Phase 6)

Расширить `AUDIT_ACTIONS` до полного каталога (каждый — GraphQL `auditLogs` + CSV + SIEM fan-out):

- Auth: sign_in / failed / sign_out / sso_login / mfa_enroll / mfa_fail / impersonate / session_revoke
- Directory: scim.user.create/update/disable, scim.group.*, member.invite/accept/revoke/role_change
- Sharing: share.publish/revoke, guest.approve, policy_update
- Content: doc.delete, doc.export, blob.delete, comment.create
- Admin: app_config.update, user.disable, signing_key.rotate
- AI: session_create, completion, embed_job, mcp.credential.*
- Billing: checkout, subscription_change, license.install, quota.seat_exceeded
- Calendar: account_link

Retention UI 30/90/180/365/unlimited. Партиции по месяцу. `MOSAIC_SIEM_WEBHOOK_URL` + Splunk HEC. Не строить свой SIEM.

**Оценка (поверх Phase 6 emit):** 2 недели каталог + Admin фильтры + партиции.

### 5.2 [P0] Admin console на Mosaic + audit UX

**Проблема.** `appConfig` возвращает `{}` + `compat.stub`. Вкладки Accounts/Settings скроены под EE config descriptors. Self-host прячет Workspaces. Нет Security / Audit / SCIM. `adminDashboard` не реализован.

**Работы.**

1. Заменить stub: `appConfig` / `updateAppConfig` / `validateConfig` читают **не-секретные** настройки Mosaic (имя, public URL, allowSignup, password min/max, feature flags, indexer/AI/billing configured). Секреты — write-only `configured` booleans.
2. Admin GraphQL полный набор из `packages/common/graphql/src/graphql/admin/*.gql`: users CRUD, disable/enable, CSV import/export, features, workspaces list **и на self-host**, shared links, mail deliveries, test email, auth signing keys.
3. Вкладки: **Security** (SSO, SCIM token, MFA enforce, session, IP, guest domains), **Audit** (фильтры, CSV, retention), **Usage / Dashboard** (§5.20), **Billing/License**.
4. Не тащить EE `config.json` модули as-is; переписать descriptors под Mosaic env.

**Оценка.** 5–6 недель (1 frontend + backend appConfig + users). Dashboard — §5.20.

### 5.3 [P0] Почта, инвайты, Notifications

**Проблема.** Invites создают id без письма. Magic link / open-app бросают `emailServiceNotConfigured`. GraphQL `listNotifications` пустой; realtime `notification.count.get` = 0; `mention-user` нет.

**Работы.**

1. SMTP adapter (env) + outbox table + job worker. Провайдеры: generic SMTP; опционально SES / Gmail API.
2. Шаблоны: invite, magic link, mention, comment, due, «you were removed», verify/change email/password (`send-verify-email`, `send-change-email`, `send-set-password-email`, …).
3. Persist `notifications` + GraphQL:
   - `currentUser.notifications(pagination)` — `list-notifications.gql`
   - `readNotification` / `readAllNotifications`
   - `mentionUser` → notification + optional email
   - realtime `notification.count.get` / `notification.count.changed`
4. Prefs: `receiveInvitationEmail` / mention / comment — записать в БД (`get-user-settings` / `update-user-settings`).
5. Типы: invite, mention, comment, role-change, billing (invoice failed, seat exceeded), AI quota.

**Оценка.** 4 недели.

### 5.4 [P0] Facilitation на доске

Перенос §5.4 старого enterprise-плана. Канал тот же: `packages/frontend/whiteboard/src/collab` (`wbCollab`). Флаг `enable_whiteboard_facilitation`.

| Фича | Модель |
| ---- | ------ |
| Таймер | Awareness `{ endsAt, paused }` |
| Dot voting | Yjs session (пережить reload) |
| Лазер | Awareness TTL ~800ms, отдельный визуал |
| Private mode | UX-фильтр по authorId, **не security** |
| Facilitator lock | Расширить `lockedBySelf` / `canEditBoardWidgets` |
| Summon | One-shot viewport, не follow |
| Presentation | Frames + timer/vote поверх |

**Оценка.** ~8 недель, 1 frontend. Демо: воркшоп-сценарий из старого плана.

Chrome доски (левый rail, sticky, панели) — не facilitation: `plans/mosaic_workshop_chrome_plan.md`. Facilitation-кнопки садятся на тот же rail после WC1.

### 5.5 [P0/P1] AI Gateway + Copilot + MCP + embeddings

Сейчас: `AiGatewayService` — один `MOSAIC_AI_API_KEY`, три GraphQL-мутации, REST `/ai/kanban`. Клиент ждёт полный Copilot-контур (`copilot-*.gql`, BYOK profiles, MCP, embeddings).

**Архитектура.** Единственный порт `AiGateway`:

```
Copilot UI / canvas skills / MCP tools / embed job
        │
  AiGateway (auth, quota, plan, redaction, audit ai.completion)
        │
  Providers: OpenAI-compatible | Anthropic | Azure | local
        │
  Workspace BYOK overlay (workspace-byok-*.gql)  OR  instance key
```

#### 5.5.1 AI Gateway (ядро)

1. Маршрутизация `promptName` → model (chat, tools, embed, vision, transcript).
2. Квоты: user/org tokens + `copilot.quota` (`limit`/`used`); hard-stop 429 с UserFriendlyError.
3. Audit: `ai.session_create`, `ai.completion`, `ai.embed_job` (без сырого промпта в логах по умолчанию; opt-in retention).
4. Streaming: Yoga SSE / multipart, `StreamObject` как в schema (`textDelta`, tool calls).
5. Rate limit per key / per workspace.
6. Redaction hook перед провайдером (PII) — позже стык с DLP.

#### 5.5.2 Copilot GraphQL (закрыть `copilot-*.gql`)

Сессии: create / createWithHistory / get / list recent / fork / update / cleanup / get latest doc.  
Истории: list, pinned, doc sessions, workspace sessions, get ids.  
Сообщения: `createCopilotMessage` + stream.  
`copilot.quota`, `copilotRouteOptions`.  
Workspace: `enableAi`, ignored-docs add/remove/get, artifacts add/get/remove.  
Transcript: submit / get / retry / settle (job queue, не в request path).  
BYOK: `workspace-byok-config-upsert/test/delete`, `profile-reorder`, `local-lease-create`, `workspace-byok-settings`.

Advertise `ServerFeature.Copilot` только когда gateway enabled.

#### 5.5.3 MCP

1. `GET /api/workspaces/:id/mcp` — URL + auth hint для клиентов.
2. GraphQL `mcpCredentials` / create / rotate / revoke; `mcpCredentialReadWriteAvailable`.
3. Tools v1 (read): `search`, `read_document`, `list_docs`. Write (`edit_document`) — за флагом и DocRole.
4. Token = hashed secret, scopes, expiry, lastUsedAt; audit `mcp.credential.*`.

#### 5.5.4 Embeddings / RAG

1. Job: chunk Yjs text + comments + widget extractors → embed → `embedding_chunks` (pgvector **или** внешний store).
2. `workspace-enable-doc-embedding`; ignored-docs исключают чанки.
3. Retrieval tool в Copilot: top-k по workspace ACL.
4. Advertise `ServerFeature.CopilotEmbedding` только после первого успешного index.
5. Progress: realtime `workspace.embedding.progress.get` (сейчас `{total:0,embedded:0}`).

#### 5.5.5 Canvas AI (продукт)

1. Streaming chat как в §5.5.2.
2. `wb:chart from prompt` → enum + mapping → `sanitize.ts` (не сырой ECharts).
3. Stickers → board: REST `/ai/kanban` + Creation bar UX.
4. Summarize board / group stickers.

**Оценка.** Gateway + session/history/stream — 4 недели. MCP — 2. Embeddings — 4. Canvas AI UX — 3. BYOK profiles — 2. Transcript — 2. Итого ~12–14 недель, параллелизуемо.

### 5.6 [P1] Интеграции, SDK, webhooks

1. Webhook events: `doc.updated` (debounce), `comment.created`, `member.*`, `board.widget.created`; очередь + retry (N-15).
2. Publish `@affine/whiteboard-sdk` (типы `registerGfxWidget` / PluginContext / `mosaic.board.*`) + README + example. Контракт sticky/frame/card/connector/viewport/panel/metadata — WC4 `mosaic_workshop_chrome_plan.md`. Без `@mirohq/*` в dependencies.
3. Slack: share board link, comment/mention notify (не только unfurl).
4. Teams Incoming Webhook как тонкий канал.
5. Jira: OAuth/token в org secrets; `externalRef` на kanban row; mapping Status; Planner — после Format shell.
6. Linear/Asana — тот же `IssueSource`, после Jira.
7. Calendar — §5.19 (больше не «P2 потом»).

**Оценка.** Webhooks hardening 2 нед. SDK 2 нед. Slack 3 нед. Jira UI 3–4 нед (сервер уже есть).

### 5.7 [P1] Governance add-on (Guard)

1. Sensitivity label на документе; guardrail «Confidential ⇏ public link».
2. Retention + legal hold: хук перед GC snapshots/blobs; `legalHold` блокирует delete.
3. BYOK: S3 bucket encryption AWS/GCP KMS CMK per org; приложение не шифрует само.
4. `ContentClassifier` port на persist blob/update — no-op default.
5. eDiscovery zip (N-22) — P2.
6. Optional Postgres RLS `workspace_id = current_setting` для managed multi-tenant — spike, не блокер self-host.

**Оценка.** Labels+retention 3 недели. KMS 3–4. DLP hook 1.

### 5.8 [P1] Accessibility WCAG 2.2 AA

1. axe-core в Playwright, non-blocking → blocking на core flows.
2. Keyboard explore board (Tab/arrows по top-level gfx).
3. ARIA на L1/L2 виджетах (L0 уже `role="img"`).
4. `prefers-reduced-motion` + существующий battery-save.
5. Alt на chart/sketch snapshots.
6. Ежегодный VPAT — процесс, не разовый спринт.

**Оценка.** ~6 недель + ongoing.

### 5.9 [P2] Sensitivity — см. §5.7.1 (дешёвая версия Guard)

### 5.10 [P0] Full-text indexer + Search

Query-time `SearchService` (Yjs JSON stringify на каждый запрос) **не** enterprise: нет `aggregate`, нет ранжирования, нет виджетов, O(n) по workspace.

**Целевой indexer**

1. **Писатель:** job на compact / comment / blob complete / widget extract. Очередь из §5.14.
2. **Хранение v1:** Postgres FTS (`tsvector` + GIN) + таблица `search_documents` (workspace_id, doc_id, block_id, flavour, text, updated_at).
3. **Хранение v1.1:** pgvector для embeddings (§5.5.4) рядом, не вместо FTS.
4. **Хранение v2 (если объём):** Elasticsearch / OpenSearch / Manticore за тем же портом `IndexStore` — self-host выбирает драйвер в `appConfig`.
5. GraphQL:
   - `workspace.search` (`indexer-search.gql`) — boolean/match/boost/exists как сейчас контракт
   - `workspace.searchDocs` (`indexer-search-docs.gql`)
   - `workspace.aggregate` (`indexer-aggregate.gql`) — buckets + hits
6. Extractors: page title, note/paragraph, comments, `wb:chart.title`, kanban card title/description, sketch text, database cells.
7. ACL на каждый хит (membership + public + DocRole).
8. Reindex API: admin `POST /api/admin/indexer/reindex?workspaceId=`.
9. Метрики: `index_lag_s`, `index_docs_total`, `search_p95_ms`.

Advertise `ServerFeature.Indexer` только когда writer живой (сейчас advertise при query-time — после cutover indexer либо честный, либо флаг снимать на маленьких инстансах).

**Оценка.** FTS writer + aggregate — 4 недели. Widget extractors +2. ES driver — 3 (P2).

### 5.11 [P2] Mobile / offline доска

Отдельный LOD-профиль, toolset create-only для chart/sketch, kanban read+move. Флаг `enable_mobile_edgeless_editing`. Offline уже nbstore.

**Оценка.** 4–5 недель.

### 5.12 [P1] Mosaic API v2 + tokens

1. PAT / org tokens: scopes `read:docs`, `write:webhooks`, `admin:scim`.
2. REST `/api/v2/orgs`, `/workspaces`, `/docs/:id/export`, webhooks CRUD (сейчас уже workspace webhooks).
3. OpenAPI. GraphQL v1 не ломать.
4. Rate limit per token.

**Оценка.** 3 недели.

### 5.13 [P0] Billing, Stripe, license keys, seat enforcement

Clean-room вынес это из MVP. Enterprise **включает**. Реализация Mosaic, wire = существующие `@affine/graphql` документы, чтобы MIT UI (settings billing, self-host license modal, quota banners, `inviteMembers` errors) заработал без форка клиента.

**Не копировать** `packages/backend/server` payment/license. Писать по Stripe API + форме ответов `.gql`.

#### 5.13.1 Модель планов

| Канал | Как продаём | Seat |
| ----- | ----------- | ---- |
| Cloud | Stripe Checkout + Customer Portal | `quantity` = seats; `memberLimit` = quantity |
| Self-host | Signed license file/JWT (Mosaic issuer) | `quantity` из лицензии; offline grace |
| Dev/OSS | Env `MOSAIC_PLAN=unlimited` | как сейчас 10000, явно |

Планы (имена на проводе как ждёт клиент `prices.plan` / `subscription.plan`): Free / Pro / Team / Enterprise. SSO/SCIM/audit — gate Enterprise (и Team по решению продукта). Copilot tokens — отдельная metered line или included quota.

#### 5.13.2 Stripe (cloud)

GraphQL: `prices`, `subscription`, `subscriptionRefresh`, `subscriptionRequest`, `createCheckoutSession`, `createCustomerPortal`, `cancelSubscription`, `resumeSubscription`, `updateSubscriptionBilling`, `invoices`, `invoicesCount`, `workspaceInvoices`, `workspace.subscription`.

REST: `POST /api/stripe/webhook` — idempotent `stripe_events.event_id`; подпись `Stripe-Signature`. События: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid/failed`.

Customer = org (не каждый workspace, если не team-workspace billing — тогда workspace = Stripe customer, как ожидает UI `get-workspace-subscription`).

Тесты: stripe-mock / fixtures, без live ключа в CI.

#### 5.13.3 License keys (self-host)

GraphQL: `workspace.license` / `getLicense`, `installLicense(Upload!)`, `activateLicense`, `deactivateLicense`, `previewLicense`, admin `generateLicenseKey`.

Формат: JSON/JWT, поля как `licenseBody`: `expiredAt`, `quantity`, `recurring`, `variant`, `installedAt`, `validatedAt`. Подпись ключом Mosaic (offline verify). Recurring: периодический revalidate если задан license-server URL, иначе expiry.

`generateLicenseKey` — только instance Admin / внутренний tooling, не публичный signup.

#### 5.13.4 Quota + seat enforcement

Заменить generous stub `quota.gql`:

- `blobLimit`, `storageQuota`, `historyPeriod`, `memberLimit` + `humanReadable`
- `quotaUsage.storageQuota` — сумма blobs
- `workspace.quota` согласован с user quota

Проверки (один `QuotaService`):

1. `inviteMembers` / `acceptInviteById` / invite-link / SCIM User create → `MEMBER_QUOTA_EXCEEDED` (или существующий UserFriendlyError код, который клиент уже показывает).
2. `createBlobUpload` / `setBlob` → storage/blob limit.
3. Copilot → token quota.
4. History GC обрезает по `historyPeriod`.

`approveMember` больше не «no seat review»: если план Team с review — очередь, иначе как сейчас.

#### 5.13.5 Feature advertising

`ServerFeature.Payment` — только cloud + Stripe keys. Self-host с лицензией — Payment off, license UI on. Не включать оба конфликтующих chrome без нужды.

Audit: `billing.checkout`, `billing.subscription_change`, `license.install`, `quota.seat_exceeded`.

**Оценка.** QuotaService + seat lock — 1 неделя. Stripe Checkout/Portal/webhooks/invoices — 4 недели. License issue/install/validate — 3 недели. Admin generate-key + prices catalog — 1 неделя.

### 5.14 [P0] Production platform (HA / DR / jobs)

Блокер реального enterprise-деплоя, даже без SCIM.

| Компонент | Работа |
| --------- | ------ |
| Redis | Socket.IO adapter, rate-limit store, session optional; `/health/ready` ping |
| S3 | `BLOB_DRIVER=s3` (S3-compatible: MinIO/R2/AWS); presigned PUT вместо self-token когда возможно |
| Jobs | pg-boss **или** BullMQ: compact, blob GC, mail, webhook retry, audit purge, **index**, **embed**, **transcript**, Stripe reconcile |
| OTLP | SDK Fastify + GraphQL + WS spans |
| Backup | Документ + скрипт: `pg_dump` + blob sync; RPO 24h self-host default |
| Helm | Chart: server HPA, postgres operator optional, redis, minio |
| Headers | CSP, HSTS, `Permissions-Policy`; cookie Secure defaults |
| Multi-instance | Stateless app; awareness через Redis; compact под advisory lock (mutex уже есть) |

**Оценка.** 4–6 недель платформенного инженера.

### 5.15 [P0] Качество, security, cutover-проверка

То, что clean-room пометил «в этой среде не гонялось»:

1. Dual-browser e2e: login → board → collab → blob → reload (Playwright, не только `backend/test/phase5`).
2. Chaos: kill server mid-push, idempotent retry (уже unit) + live.
3. Contract tests против golden nbstore fixtures.
4. Load: 100 awareness; p95 push-fanout &lt; 100ms LAN.
5. IdP lab: samltest.id + mock SCIM.
6. Security checklist: OWASP ASVS L2 light, dependency scanning в CI (уже mosaic-server workflow — расширить).
7. Включить whiteboard flags default true после e2e.

### 5.16 [P3] Marketplace

Слой 2–3 whiteboard SDK. Не начинать, пока нет 2+ внутренних виджетов на публичном контракте и хотя бы одного внешнего пилота.

### 5.17 Kanban Format (P0 продукт / P1 enterprise)

Полный перенос фаз A–C `miro_kanban_parity_plan.md` в этот трек. D Timeline и E AI — P1. F Jira two-way — стык с §5.6.

### 5.18 [P0] Полноценный GraphQL (compat без stub)

**Проблема.** Yoga поднимает только срез schema. Клиент шлёт operations из `packages/common/graphql`; неизвестные поля/ops → пустой UI или ошибки. `appConfig`, billing, calendar, notifications, часть Copilot, MCP — stub.

**Работы.**

1. Инвентарь CI: скрипт сверяет `*.gql` operation names с Yoga schema; fail если op есть у клиента и нет в сервере (кроме явного `wontfix` списка).
2. Закрыть кластеры §2.5 по фазам: admin → notify/email → copilot → indexer aggregate → billing/license → calendar → MCP.
3. Единый error mapping UserFriendlyError (коды, которые клиент уже свитчит: `MEMBER_QUOTA_EXCEEDED`, `ACTION_FORBIDDEN`, `EMAIL_SERVICE_NOT_CONFIGURED`, …).
4. `serverConfig.features` advertise честно: `Payment`, `Copilot`, `CopilotEmbedding`, `Indexer`, `OAuth`, `Comment`, `Captcha`.
5. Убрать `compat.stub` логи из production path; в тестах — assert zero stub на happy-path suite.
6. GraphQL v2 Mosaic (`mosaicOrg`, `mosaicAudit`, …) — аддитивно, не ломая v1.

**DoD.** `backend/test/contract/graphql-surface.test.ts`: каждый MIT operation либо resolver, либо listed wontfix. Admin dashboard и quota не stub.

**Оценка.** Сквозной каркас + CI gate — 1 неделя. Закрытие кластеров входит в оценки §5.2–5.13/5.19.

### 5.19 [P1] Calendar + GCloud plugins

#### Calendar

Клиент: `calendar-events.gql`, `calendar-providers.gql`, `workspace-calendars.gql`, `link-caldav-account.gql`, `update-workspace-calendars.gql`.

1. Провайдеры: Google Calendar (OAuth) + generic CalDAV (Fastmail/Nextcloud).
2. Хранить account tokens encrypted (org secret / KMS), не в Yjs.
3. Sync job → `calendar_events_cache`; GraphQL events в окне дат.
4. Workspace calendars: enable set of calendars, overlay на доске/doc (клиент уже рисует).
5. Audit `calendar.account_link`.

#### GCloud (optional adapters)

Не форк EE `plugins/gcloud`. Порты:

- Metrics → Cloud Monitoring (рядом с Prometheus `/metrics`)
- Logs → Cloud Logging (рядом с pino)
- Blobs → GCS через S3-compatible или `@google-cloud/storage` driver (`BLOB_DRIVER=gcs`)
- KMS → Cloud KMS для §5.7 BYOK

Включается env `MOSAIC_GCP_PROJECT`. Self-host по умолчанию — off.

**Оценка.** Calendar Google+CalDAV — 4 недели. GCS driver — 1 (после S3). GCloud logging/metrics — 1–2.

### 5.20 [P1] Полный admin analytics (`adminDashboard`)

Контракт: `admin/admin-dashboard.gql`.

| Поле | Источник |
| ---- | -------- |
| `syncActiveUsers` + timeline | Socket.IO rooms / Redis presence counters, bucket minute |
| `syncWindow` | запрошенный диапазон, timezone, bucket |
| `copilotConversations` + `copilotWindow` | `copilot_sessions` / `ai_usage_events` |
| `workspaceStorageBytes` / `blobStorageBytes` + history | blob meta sum, daily rollup job |
| `topSharedLinks` (views, unique, guest, lastAccessed) | счётчики на `GET public-docs` + publish table |
| `generatedAt` | now |

Дополнительно (admin SPA): mail deliveries (`admin-mail-deliveries`), shared links list (`admin-all-shared-links`).

Не строить отдельный warehouse в v1: nightly rollup в `analytics_daily` + live counters в Redis. Cloud: те же цифры в Stripe usage (optional).

**Оценка.** 3 недели после jobs + public-doc counters.

---

## 6. Дорожная карта

Спринты по 2 недели. Шесть треков; зависимости: **E-Plat** не блокирует facilitation, но блокирует HA, mail, indexer jobs и Stripe webhooks; **E0** блокирует enterprise-сделку; **E5** (billing) блокирует cloud-продажу и честный seat lock.

### Фаза E-Plat — Production backbone (6–8 недель) — трек Platform

- [x] Redis adapter Socket.IO + ready-check
- [x] S3-compatible blobs (+ GCS driver stub)
- [x] Job queue: compact, GC, mail, webhooks, **index**, **embed**
- [x] SMTP + notification store + GraphQL list/read/mention
- [x] OTLP
- [x] Backup runbook + Helm draft
- [x] `appConfig` / `updateAppConfig` не stub (server/auth/flags)
- [x] CI gate: GraphQL operations vs schema (§5.18)

**Exit:** два реплики Mosaic за одним Redis; reload доски; письмо-инвайт уходит; `listNotifications` не пустой после invite.

**Сделано в коде (2026-09-13).** Compose HA draft: `backend/docker-compose.ha.yml`. Письмо-инвайт уходит через outbox + SMTP/MemoryMailer. `listNotifications` заполняется после invite/mention. `/health/ready` падает, если `REDIS_URL` задан и Redis недоступен.

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Compact по-прежнему inline на `space:push-doc-update`; job `doc.compact` — catch-up/operator, не единственный путь.
- Index/embed handlers только ставят контракт очереди; FTS writer и embeddings — E4/E2. `ServerFeature.Indexer` по-прежнему query-time.
- `BLOB_DRIVER=gcs` — явный stub (ошибка 501); production GCS = S3 XML API.
- Presigned PUT на S3 не подключён к `createBlobUpload` (клиент по-прежнему PUT на Mosaic, сервер пишет в S3).
- Redis rate-limit store не подключён (`@fastify/rate-limit` in-process).
- Magic-link / open-app email по-прежнему `EMAIL_SERVICE_NOT_CONFIGURED` (N-24 / полный набор шаблонов — не E-Plat exit).
- Helm — draft (app HPA + anti-affinity), без postgres-operator subchart.
- Dual-replica live e2e в этой среде не гонялся (нужны Docker/два процесса).
- `sendTestEmail` шлёт через уже настроенный MailPort, не поднимает ad-hoc SMTP из GraphQL-секрета (N-10).
- CI GraphQL gate: **86** MIT `.gql` валидируются против Yoga schema; **91** явно в `backend/docs/graphql-wontfix.json` (admin dashboard, billing, calendar, полный Copilot, MCP, indexer aggregate) — закрываются фазами E2/E4/E5. Admin users/workspaces/signing-keys закрыты в E0.

### Фаза E0 — Identity & Admin (10–12 недель) — трек IAM

- [x] Organization + domain verify
- [x] Per-org SSO + JIT + enforce
- [x] SCIM v2 Users/Groups (Okta, Entra)
- [x] TOTP + WebAuthn + recovery
- [x] IP allowlist, idle/max session
- [x] Admin Security + Audit UI + CSV
- [x] Admin users GraphQL (`list-users` … `import-users`)
- [x] Guest domains + `blockPublicEditLinks`
- [x] SCIM deprovision отзывает сессии и push

**Exit:** Okta lab: SCIM create → SAML login → audit row → SCIM disable → sync push 403.

**Сделано в коде (2026-09-13).** Clean-room `@mosaic/server`: org/domain TXT verify, JIT/SSO enforce только на verified domain, SCIM v2 Users/Groups (`application/scim+json`), TOTP+recovery, IP allowlist + session idle/max, admin GraphQL users/workspaces/signing-keys/mail/shared-links, Admin SPA Security/Audit (+ Workspaces на self-host), i18n `com.affine.admin.*` / `com.affine.auth.mfa.*` (en+ru). Тесты: `backend/test/e0/identity-admin.test.ts`. GraphQL surface: **86** implemented / **91** wontfix (`admin-dashboard.gql` остаётся E4).

**Не полностью (зафиксировано, не блокирует чеклист фазы):**

- Live Okta / Entra lab не гонялся (нет внешнего IdP в этой среде). Контракт закрыт in-process: SCIM create → audit → SCIM disable → `space:push-doc-update` 403.
- WebAuthn: хранение credentialId/publicKey + challenge; нет полной церемонии `@simplewebauthn/server` (attestation/assertion verify).
- Per-org IdP сохраняется (OIDC/SAML поля, group map), но ACS/authorize login по-прежнему instance env (`MOSAIC_OIDC_*` / `MOSAIC_SAML_*`).
- MFA policy `all` / `if_not_sso` требует уже enrolled TOTP/passkey; не enrolled пользователь всё ещё входит паролем (force-enroll UX не сделан).
- `adminDashboard` GraphQL — E4, в `graphql-wontfix.json`.
- Audit CSV — instance admin REST `/api/admin/audit-logs?format=csv`; SIEM partition drop / postgres-operator — не E0.
- Magic-link / open-app email — leftover E-Plat (`EMAIL_SERVICE_NOT_CONFIGURED`).

### Фаза E1 — Facilitation + Kanban Format (8–10 недель, параллельно E0) — трек Product

- [x] Timer, vote, laser, lock, summon, private, presentation
- [x] Workshop chrome WC0–WC2: Mosaic-токены, left creation rail, sticky preset (`plans/mosaic_workshop_chrome_plan.md`)

**WC0 (2026-09-13, не закрывает пункт выше):** токены и recipes в `packages/frontend/whiteboard/src/chrome/` (акцент `#0d7377`, hit 32/36, sticky light/dark, contrast ≥ 4.5:1, флаг `enable_workshop_chrome` default false).

**WC1 (2026-09-13, не закрывает пункт выше):** left rail overlay через widget `wb-workshop-chrome` + adopted CSS на stock toolbar/zoom/selection (не fork `edgeless-toolbar.ts`). Fallback нижнего бара при флаге off / mobile / viewport ≤1200. Playwright spec 1440/1280 написан, **не гонялся**.

**WC2 (2026-09-13, не закрывает пункт выше):** sticky = пресет `affine:note` (`edgeless.kind: 'sticky'`), `StickyTool` + rail button + Mosaic palette на selection bar, slash без Page/embed/Database, gfx `connectable`. Playwright sticky spec написан, **не гонялся**. Flag default false.

**WC3 (2026-09-13, не закрывает пункт выше):** frame title 24 / empty dashed, app-card skin bookmark+linked-doc, `tags[]` + chips/picker (workspace catalog), chrome skeleton `wb:record-card` без Kanban sync. Playwright objects spec написан, **не гонялся**. Flag default false.

**WC4 (2026-09-13, не закрывает пункт выше):** `mosaic.board` слой 1 в `@affine/whiteboard` `src/sdk`: viewport get/set/zoomTo/fit/lock, create sticky/frame/card/connector, item mosaicMeta ≤6KB, BlockMeta на note/frame, dock Templates/Frames (`wb-board-panel`). Playwright sdk spec написан, **не гонялся**. Flag default false.

**WC5 (2026-09-13, не закрывает пункт выше):** галерея Mosaic (retro/2×2/agenda/pastel) + Affine snapshots в левом доке, insert в центр / выбранный frame, inspector справа для chart/board/sketch. Playwright templates spec написан, **не гонялся**. Flag default **false** (e2e WC1–WC4 не гонялись).
- [x] Kanban A+B+C (toolbar, table switch, ingest/egress, 14 templates)
- [ ] Default-on flags после smoke e2e
- [ ] Dual-browser Playwright whiteboard

**Exit:** воркшоп 5 человек: стикеры → kanban, таймер, voting, summon.

**Сделано в коде (2026-09-13).** Флаг `enable_whiteboard_facilitation` (default **false**): таймер / pause на awareness `{ endsAt, paused }`, laser TTL 800ms, summon one-shot, private mode (UX-фильтр `meta:createdBy`), facilitator lock (viewport + `canEditBoardWidgets`), presentation prev/next по `affine:frame`, dot voting в Y.Map `wbFacilitation` (переживает reload). Presence bar `data-testid=wb-facilitation`. Kanban Format: `layout`/`viewId`/`syncMode`/`focusMode` на `wb:board`, toolbar (Kanban↔Table, Fields, Hide, Focus, CSV, synced view / duplicate), table view seed вместе с kanban, ingest стикеров в колонку (только drag, не click), egress `wb:record-card` с live title, clone paste копирует rows по имени полей, 14 шаблонов в каталоге + slash + dock «Kanban & flows». Unit-тесты whiteboard. Playwright facilitation/kanban spec написаны, **не гонялись**.

**Не полностью (зафиксировано, не блокирует чеклист фазы A+B+C в коде):**

- Default-on `enable_board_widget` / `enable_whiteboard_facilitation` / `enable_workshop_chrome` — после live smoke e2e (пункт ниже).
- Dual-browser Playwright: spec-заготовка `tests/affine-local/e2e/whiteboard/kanban-format.spec.ts` skipped; два клиента в этой среде не поднимались.
- Filter/Sort UI — lane filter и hide; полный `FilterGroup` data-view в шапке не включён (`headerWidget` по-прежнему undefined, свой toolbar).
- Keyboard Enter/Tab parity в focus — опирается на data-view, отдельный hotkey-слой не добавлялся.
- Timeline layout (фаза D) и AI Sidekick (фаза E) — не E1; `release-train` остаётся kanban Now/Next/Later.
- Private mode не security: скрытие DOM по автору, не ACL.
- Paste dialog «Synced view / Duplicate» — действия в toolbar ⋮, не модалка при Ctrl+V; default paste = owned clone с копией rows по имени полей.
- «Save board as template» (Kanban C4 / Custom Blueprints) — не E1.
- SVG-превью 14 шаблонов в Affine EdgelessTemplatePanel — не рисовались; каталог живой в slash + dock Templates (`Kanban & flows`) при `enable_workshop_chrome`.
- Live e2e facilitation/kanban Playwright specs написаны, **не гонялись**.
- i18n.gen.ts не регенерировался в этой среде (I18n proxy принимает неизвестные ключи; en.json + ru.json заполнены).
- Laser/summon dual-browser не гонялись.

### Фаза E2 — AI Gateway, Copilot, MCP, embeddings, Calendar (10–12 недель)

- [x] AI Gateway: routing, quota, stream, audit
- [x] Полный Copilot session/history/message GraphQL
- [x] Workspace BYOK profiles
- [x] MCP credentials + `GET .../mcp` + read tools
- [x] Embedding jobs + `CopilotEmbedding` + progress realtime
- [x] Canvas AI (chart + stickers→board)
- [x] Calendar Google + CalDAV
- [x] Webhook queue + Slack + Jira UI
- [x] Whiteboard SDK слой 1
- [x] API tokens + OpenAPI v2

**Exit:** чат с RAG по своей доске; MCP из IDE читает doc; календарь события в GraphQL.

**Сделано в коде (2026-09-13).** Clean-room `@mosaic/server` (`backend/`): AI Gateway (`promptName` → chat/embed/vision/transcript, `MOSAIC_AI_QUOTA_TOKENS`, audit `ai.session_create` / `ai.completion` / `ai.embed_job`, REST SSE `POST /api/workspaces/:id/ai/chat/stream`). Copilot GraphQL: session create/withHistory/get/list/fork/update/cleanup, chats/histories/messages, quota, routeOptions, ignored-docs, artifacts, transcript submit/get/retry/settle (очередь). `ServerFeature.Copilot` только при `MOSAIC_AI_API_KEY`; `CopilotEmbedding` только после первого успешного index. Workspace BYOK profiles (create/replace/rotate/delete/reorder/probe/lease/usage; credentials base64, не в логах). MCP: GraphQL credentials create/rotate/revoke, `GET /api/workspaces/:id/mcp`, JSON-RPC tools `search` / `read_document` / `list_docs`; write `edit_document` за `MOSAIC_MCP_WRITE_ENABLED`. Embeddings: job chunk Yjs+comments, hash-vectors, RAG в chat, realtime `workspace.embedding.progress.get`, `enableDocEmbedding`. Canvas AI: `POST .../ai/chart` (bar|line|pie|scatter JSON) + существующий `/ai/kanban`. Calendar: `calendarProviders` Google+CalDAV, CalDAV presets + GraphQL events; Google link возвращает URL и сразу stub-account. Webhooks: очередь/retry уже E-Plat; Slack Incoming Webhook JSON если URL `hooks.slack.com`; Jira `GET .../jira` `{ configured }` + существующий REST. Whiteboard SDK слой 1 — WC4 (`@affine/whiteboard` `src/sdk`). API v2: PAT `mosaic_pat_…` scopes `read:docs`/`write:webhooks`/`admin:scim`, `GET /api/v2/workspaces`, `GET /api/v2/openapi.json`. Persistence: memory + Postgres migration `008_e2`. Тесты: `backend/test/e2/ai-platform.test.ts`. GraphQL surface: **129** implemented / **48** wontfix. i18n en+ru: `com.affine.settings.workspace.mcp|calendar|embedding|api-tokens|integrations.*`, chat-panel, BYOK.

**Не полностью (зафиксировано, не блокирует чеклист фазы в коде):**

- Live Google Calendar OAuth (consent + token refresh) нет: `linkCalendarAccount` сразу создаёт stub-account; токены base64, не KMS.
- CalDAV — store + mock ICS/seed event, не живой CalDAV-клиент (Fastmail/Nextcloud PROPFIND).
- Transcript — queued placeholder, без реального STT.
- Embeddings — локальные hash-векторы (dim 32), не pgvector/OpenAI embeddings; widget extractors канбана — E4 indexer.
- Stream — REST SSE (`/ai/chat/stream`), не Yoga multipart GraphQL subscription.
- Redaction/PII hook перед провайдером — **сделано в E3** (`DlpService`, default off).
- Slack: только формат Incoming Webhook по URL; нет OAuth, unfurl, mention fan-out.
- Jira UI: флаг `configured` + существующий REST; нет OAuth, status mapping UI, two-way на `wb:board`.
- API v2 — срез (tokens + workspaces + OpenAPI); нет `/api/v2/orgs`, `/docs/:id/export`, per-token rate limit.
- GCloud plugins (metrics/logging/GCS/KMS) — не E2, остаются в «Позже».
- MCP write tools выключены по умолчанию (`MOSAIC_MCP_WRITE_ENABLED`).
- Probe BYOK всегда stub-verified, без live вызова провайдера.
- `i18n.gen.ts` не регенерировался (I18n proxy принимает неизвестные ключи; en.json + ru.json заполнены).
- Playwright / live dual-browser / реальный IDE MCP client не гонялись.
- Default-on флаги facilitation/kanban/chrome остаются **false** (E1).

### Фаза E3 — Guard + a11y (10–12 недель)

- [x] Sensitivity + sharing guardrail
- [x] Retention / legal hold
- [x] KMS на S3/GCS
- [x] DLP hook
- [x] GDPR export/delete
- [x] axe + keyboard nav + ARIA

**Сделано в коде (2026-09-13).** Clean-room `@mosaic/server` (`backend/`): Guard labels `Public | Internal | Confidential` на документе; `assertCanPublish` блокирует public link для Confidential (выкл. `MOSAIC_CONFIDENTIAL_BLOCKS_PUBLIC=false`); установка Confidential отзывает уже опубликованный doc. Retention + legal hold: GraphQL `setWorkspaceRetention` / `WorkspaceType.retentionPolicy`; hold блокирует `deleteWorkspace`, hard-delete blob/doc, `purgeWorkspace`; `gcWorkspace` / trim history пропускают объекты, пока hold или `retentionDays` не истекли. DLP: порт `ContentClassifier` + `RegexContentClassifier` (email / PAN / `sk|mosaic_pat|mosaic_mcp`); режимы `off|redact|block` (`MOSAIC_DLP_MODE`, default off); хук перед AI provider и на text blob commit. GDPR: `exportMyData` JSON (user, memberships, public docs, blob meta, copilot session ids, audit) + `deleteAccount` (hold-check owned workspaces, revoke sessions, `deleteUser`). KMS: S3 PutObject `x-amz-server-side-encryption` AES256/`aws:kms` + optional key id; GCS хранит `kmsKeyName` (`kmsConfigured()`), native put/get/delete по-прежнему stub. `ServerConfigType.kmsConfigured`. Persistence: memory + Postgres `009_e3`. Тесты: `backend/test/e3/guard.test.ts`. GraphQL surface: **130** implemented / **47** wontfix (`deleteAccount` сняли с wontfix). Whiteboard: `WhiteboardExploreLayerExtension` (Tab/Shift-Tab + arrows, `aria-live`), ARIA/snapshot-alt на chart/board/sketch, `prefers-reduced-motion` на ECharts animation. Playwright `tests/affine-local/e2e/whiteboard/a11y.spec.ts` (skip unless `A11Y=1`). i18n en+ru: `com.affine.settings.workspace.guard.*`, `com.affine.whiteboard.{chart|board|sketch}.a11y.*`, `snapshot-alt`, `a11y.explore.announce`.

**Не полностью (зафиксировано, не блокирует чеклист фазы в коде):**

- Native GCS adapter всё ещё stub (`blobDriverUnimplemented('gcs')`); production GCS = S3-compat + HMAC. SSE-KMS — заголовки PutObject, не app-side crypto и не live round-trip Google KMS.
- DLP — regex hook, не ML / не встроенный enterprise classifier; default `off`, чтобы не ломать E2 Copilot.
- GDPR erase — срез DSAR: нет анонимизации comments, нет eDiscovery zip (N-22), нет cookie/consent UI для cloud (хвост N-9).
- axe-core spec пропускается без `A11Y=1`; `@axe-core/playwright` в affine-local не добавлен (optional dynamic import). Keyboard explore не прогонялся dual-browser. VPAT — процесс, не код.
- Postgres RLS spike (`workspace_id = current_setting`) не делался.
- Guard settings UI не подключён к GraphQL (только i18n-ключи).
- `i18n.gen.ts` не регенерировался (I18n.t / proxy принимают неизвестные ключи; en.json + ru.json заполнены).
- Playwright / live axe / login flow не гонялись в этой среде.
- Default-on флаги facilitation/kanban/chrome остаются **false** (E1).

**Exit:** 0 critical axe findings на login + edgeless create chart/board — **не закрыт** (spec есть, прогон и axe-зависимость не в CI).

### Фаза E4 — Full-text indexer + analytics + mobile (8–10 недель)

- [x] Async FTS writer + `search` / `searchDocs` / `aggregate`
- [x] Widget extractors
- [x] `adminDashboard` + storage/sync/copilot rollups + top shared links
- [x] Mobile LOD
- [x] Timeline layout (Kanban D)
- [x] Captcha optional
- [x] Optional ES/OpenSearch driver

**Сделано в коде (2026-09-13).** Clean-room `@mosaic/server` (`backend/`): async FTS writer `index.document` после compact/comment; Postgres `search_documents` + GIN / memory `ILIKE`-эквивалент; extractors page/note/paragraph/comment/`wb:chart`/`wb:board`/database cells; GraphQL `search` / `searchDocs` / `workspace.aggregate` (buckets по flavour); query-time Yjs scan остаётся fallback, если индекс пуст (phase6). Admin `POST /api/admin/indexer/reindex`. `adminDashboard`: blob+snapshot storage, copilot session count, top shared links с view counters на `GET /api/workspaces/:id/public-docs/:docId`; prometheus `mosaic_index_docs_total` / `mosaic_index_lag_s` / `mosaic_search_duration_seconds`. Captcha: `MOSAIC_CAPTCHA_ENABLED` HMAC challenge (`GET /api/auth/captcha`), default off. OpenSearch: `MOSAIC_INDEXER_DRIVER=opensearch` + `OPENSEARCH_URL` HTTP dual-write, fallback на local store. Whiteboard: `WHITEBOARD_LOD_MOBILE` + `resolveWhiteboardLod()` / create-only helper для chart/sketch; timeline layout (Kanban↔Table↔Timeline), L0 axis+strips / L1 titles / L2 date drag, scale day/week/month/quarter, invalid End&lt;Start, milestones на `view.milestones`. Persistence: memory + Postgres `010_e4`. Тесты: `backend/test/e4/indexer.test.ts`, `timeline-view.spec.ts`, `mobile.spec.ts`. GraphQL surface: **132** implemented / **45** wontfix (`admin-dashboard.gql`, `indexer-aggregate.gql` сняты с wontfix). i18n en+ru: `com.affine.whiteboard.board.layout.timeline`, `board.timeline.*`, `com.affine.admin.dashboard.*`, `com.affine.auth.captcha.*`.

**Не полностью (зафиксировано, не блокирует чеклист фазы в коде):**

- OpenSearch не live-round-trip к кластеру; CI мокает HTTP. pgvector по-прежнему hash embeddings E2, не замена FTS.
- `syncActiveUsers` / timeline = 0 без Redis presence.
- Timeline: нет BlockSuite data-view preset (kanban grouping + `props.layout='timeline'`), нет dependency lines (D4), calendar layout не рисуется.
- Mobile: conservative LOD + create-only helper; конфликт touch vs widget-DnD и default-on `enable_mobile_edgeless_editing` не делались. Live kanban/chart budget singletons по-прежнему инициализируются desktop `maxLive*`.
- Captcha — HMAC challenge, не Turnstile/hCaptcha; signup UI капчи нет.
- Exit p95 search &lt; 200ms на 10k docs **не измерялся** в этой среде.
- `i18n.gen.ts` не регенерировался (I18n.t / proxy принимают неизвестные ключи; en.json + ru.json заполнены).
- Default-on флаги facilitation/kanban/chrome остаются **false** (E1).
- Blob complete не пишет FTS-документы (нет docId у blob).

**Exit:** поиск карточки канбана по title — закрыт в unit/API тесте. Admin dashboard не все нули — закрыт для storage/copilot/shared links. p95 на 10k docs — **не закрыт**.

### Фаза E5 — Stripe, license, seats (6–8 недель)

- [ ] `QuotaService` + seat lock на invite/SCIM/blob
- [ ] Stripe Checkout, Portal, webhooks, invoices, prices
- [ ] `ServerFeature.Payment` advertise на cloud
- [ ] Self-host license install/activate/deactivate/preview + `generateLicenseKey`
- [ ] Usage meter в admin (seats, storage, AI tokens)
- [ ] Billing audit events + failed-invoice notification

**Exit:** cloud: checkout → memberLimit растёт → лишний invite получает quota error. Self-host: install license file → quantity seats.

### Позже

- [ ] Marketplace, iframe plugins
- [ ] Transcript Copilot jobs polish
- [ ] GCloud logging/monitoring extras
- [ ] Multi-region (сознательно не v1, как в clean-room §10.5)
- [ ] RevenueCat / native IAP — только если mobile store требует, не копировать EE

---

## 7. Организация работ

| Практика | Как |
| -------- | --- |
| Шесть треков | IAM, Platform, Product (facilitation+kanban), AI+Search, Commercial, Integrations |
| Contract-first | Сначала failing tests: SCIM RFC, MFA preflight, webhook signature, **каждый `.gql`**, Stripe webhook fixture, license JWT |
| DoD | Test + audit event + admin или user UX + честный `ServerFeature` |
| No EE contamination | Reviewers reject copy-paste из `packages/backend` (включая payment/copilot Nest-модули) |
| Compat | Закрывать GraphQL v1; v2 аддитивен |
| Secrets | Env/sealed; admin UI не читает client_secret / Stripe sk / license signing key обратно |
| Seat truth | Только `QuotaService`; запрет «пропустить лимит в SCIM» |
| Definition of enterprise-ready | Чеклист §10: SSO/SCIM/audit **и** Copilot/indexer/billing/admin dashboard без stub |

Оценка порядка: **2 квартала** до «можно продавать self-host Enterprise» (E-Plat + E0 + E1 + license seats). Cloud Stripe + полный Copilot/indexer/dashboard — **ещё квартал** (E2+E4+E5). Guard/a11y — параллельно.

Команда-ориентир: 1 IAM backend, 1 platform, 1 AI/indexer, 1 billing, 1 admin frontend, 1 whiteboard frontend, 0.5 QA e2e.

---

## 8. Риски и митигации

| Риск | Митигация |
| ---- | --------- |
| SCIM/IdP матрица багов | Сначала Okta+Entra; e2e на samltest.id; golden SCIM payloads |
| Audit раздувает БД | Партиции + retention с первого дня (поле уже есть `AUDIT_RETENTION_DAYS`) |
| Facilitation vs awareness jitter | Один namespace `wbCollab`, общий throttle |
| Admin SPA остаётся на EE config | E-Plat обязана заменить `appConfig` до Security tab |
| Redis/S3 откладывают «потом» | Иначе enterprise install = single node; E-Plat первая |
| LLM пишет небезопасный chart spec | Только enum + sanitize |
| Stripe PCI / ключи в репо | Только env; webhook secret; никогда sk_live в тестах |
| License key forge | Ed25519/JWT iss=Mosaic; preview не активирует seats |
| Seat bypass через SCIM | QuotaService на всех входах членства |
| Indexer лагает, UI врёт | Не advertise Indexer пока writer healthy; показать lag в admin |
| Copilot без embeddings «как RAG» | Не advertise CopilotEmbedding до первого index |
| «Полный DLP» в маркетинге | Продавать hook, не ML |
| Scope: Kanban+SSO+K8s сразу | E0 и E-Plat важнее Timeline |
| Юридический clean-room | Не читать EE при MFA/SCIM; публичные RFC |
| Frontend drift | Compat suite в CI, pin client |

---

## 9. Чего не делать

1. Не возвращать `packages/backend` в runtime image.
2. Не копировать исходники AFFiNE Stripe/license/copilot/indexer — реализовать **свои** сервисы под те же GraphQL-имена.
3. Не строить свой SIEM.
4. Не обещать block-level ACL или E2EE секций в enterprise v1 (отдельный doc / later).
5. Не обещать ML-DLP.
6. Не давать LLM сырой ECharts option.
7. Не заводить второй awareness-протокол.
8. Не делать schema-per-tenant.
9. Не делать multi-region в v1.
10. Не строить marketplace до SDK слой 1 и реальных виджетов.
11. Не расшивать секреты в GraphQL config UI (Stripe sk, SAML cert, BYOK keys).
12. Не блокировать facilitation ради billing — но **seat lock обязателен** до cloud GA.
13. Не advertise `Payment` / `Copilot` / `CopilotEmbedding` / `Indexer`, пока соответствующий путь не green в contract tests.
14. Не оставлять `compat.stub` на operations, которые рисуют UI.

---

## 10. Метрики успеха

**Security / sales**

- Security review: SSO + SCIM + MFA + audit + session policy — нет блокера «отсутствует».
- CAIQ/SIG: ответы на residency, backup, encryption, access review.
- SCIM deprovision &lt; 1 min до отказа в `space:push-doc-update`.

**Commercial**

- Cloud: Checkout → webhook → `memberLimit` = Stripe quantity; лишний invite → quota error.
- Self-host: install license → `quantity` seats; expired license → read-only или grace (продуктовое решение, задокументировать).
- `prices` / invoices / portal открываются без stub.

**AI / Search**

- Copilot stream + history; MCP read tool из внешней IDE.
- Embeddings: hit в chat с цитатой `docId`.
- Search/aggregate: карточка канбана находится по title; p95 &lt; 200ms на 10k docs.

**Admin**

- `adminDashboard` заполнен (не нули на живом инстансе).
- `appConfig` round-trip. Zero `compat.stub` на admin happy path.

**Ops**

- p95 push-to-fanout &lt; 100 ms LAN при 2+ инстансах.
- Zero data-loss soak 24h (2 clients) — перенос метрики MVP.
- Restore drill: RPO ≤ 24h, RTO ≤ 4h на staging.

**Product**

- Facilitation used в ≥ 50% сессий с 3+ collab (телеметрия).
- Kanban Format: стикеры → table roundtrip без потери записей.
- 0 critical axe findings на login + edgeless create chart/board.

**Platform**

- Image по-прежнему без `packages/backend`.
- `/health/ready` падает, если Postgres или Redis недоступны (когда включены).
- GraphQL contract suite: 100% MIT operations classified implemented|wontfix.

---

## 11. Следующий конкретный шаг

Не начинать с Timeline, Marketplace или live Stripe.

1. [x] Зафиксировать этот документ как successor `enterprise_readiness_plan.md` (тот файл — исторический gap-анализ EE-эпохи).
2. [x] E-Plat sprint 1: Redis Socket.IO adapter + ready probe + job queue skeleton + SMTP outbox.
3. [x] Параллельно: `appConfig` read-model для admin + CI список `.gql` vs schema (§5.18).
4. [ ] ADR `backend/docs/adr/0002-organization-and-scim.md` до кода SCIM.
5. [ ] ADR `backend/docs/adr/0003-billing-and-licenses.md` (Stripe vs license, seat = `QuotaService`) до кода Checkout.
6. [ ] ADR `backend/docs/adr/0004-ai-gateway-and-indexer.md` до embeddings.
7. [ ] Failing contract tests: SCIM `GET /ServiceProviderConfig`, MFA preflight, invite email outbox, `listNotifications`, `adminDashboard` shape, `quota.memberLimit`, `indexer-aggregate`.
8. [ ] Product: facilitation spike (таймер на awareness) под флагом.

После шагов 2–7: параллелить E0 (SCIM), E1 (Kanban A / timer), каркас E5 (`QuotaService` без Stripe) и writer indexer.

Stripe live keys и `generateLicenseKey` — после ADR 0003 и webhook-идемпотентности, не в первом спринте.
