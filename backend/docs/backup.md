# Mosaic Server backup and restore

Default self-host RPO is **24 hours**. Target RTO on staging restore drills is **4 hours**.

This runbook is for the clean-room Mosaic Server (`backend/`, image `mosaic-server`). It does not use `packages/backend`.

## What to copy

| Data | Location | How |
| ---- | -------- | --- |
| Postgres | `DATABASE_URL` | `pg_dump` (custom format) |
| Blobs | `BLOB_DIR` or S3/MinIO bucket | filesystem rsync **or** `aws s3 sync` |
| Secrets | env / sealed secrets | not in the database; restore the same `SMTP_*`, `S3_*`, `REDIS_URL`, OIDC/SAML env |

Redis is a **cache and Socket.IO fan-out**, not a source of truth. Do not back it up.

## Postgres dump

```bash
pg_dump --format=custom --dbname="$DATABASE_URL" --file="mosaic-$(date -u +%Y%m%d).dump"
```

Restore:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" mosaic-YYYYMMDD.dump
```

Then start Mosaic so `006_jobs` and later migrations apply.

## Blob sync

Filesystem driver (`BLOB_DRIVER=fs`):

```bash
rsync -a --delete "$BLOB_DIR"/ ./blob-backup/
```

S3-compatible (`BLOB_DRIVER=s3`):

```bash
aws --endpoint-url "$S3_ENDPOINT" s3 sync "s3://$S3_BUCKET" ./blob-backup/
```

`BLOB_DRIVER=gcs` is a stub in E-Plat. Use the GCS XML/S3 API (`BLOB_DRIVER=s3` + HMAC keys) until the native GCS driver ships.

## Suggested schedule

- Daily `pg_dump` + blob sync (RPO 24h).
- Weekly restore to a staging instance; confirm `/health/ready` and a board reload.
- Keep at least 7 daily dumps.

## Kubernetes

The draft Helm chart (`backend/deploy/helm/mosaic-server`) runs a stateless app replica set. Postgres and object storage stay outside the app pods. Use the Postgres operator or your cloud snapshot for PITR when you need a tighter RPO than 24h.
