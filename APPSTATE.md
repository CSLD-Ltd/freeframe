# Application state

## Application and current features

FreeFrame is a self-hosted media review application: projects, uploads, video/image review, timed comments, approvals, version comparison, share links and NLE comment exports. The source adds ReaperShow publication allocation, immutable per-version source timecode/lighting cues and frame/cue comment anchors. These integration features are not yet deployed at review.csld.co.uk.

## Modules and runtime wiring

- Next.js/React web in apps/web calls FastAPI apps/api using JSON HTTP and project SSE updates.
- PostgreSQL stores users/projects/assets/versions/comments and integration metadata/allocation receipts. Redis/Celery carry processing, email and maintenance work; S3/MinIO stores original and processed media. packages/transcoder runs FFmpeg.
- Development compose defaults: web 3000, API 8000, Postgres 5432, Redis 6379, MinIO 9000/9001. .env.example documents DATABASE_URL, REDIS_URL, S3_*, JWT_SECRET and frontend origin settings. Hosted deployment configuration is maintained separately from this feature branch.
- Current CSLD hosted runtime remains on its separately configured hosting/email/thumbnail source baseline; this branch does not include or replace those infrastructure changes.

## User flows

Upload/project review and ordinary share links retain existing behavior. ReaperShow explicitly allocates one take/export asset, streams multipart data through existing upload routes, attaches immutable path-free metadata and reconciles ready state before creating a comment-enabled/no-download link. Reviewers navigate source clock/cue occurrences and submit exact frame/hash/cue anchors; legacy seconds remain available for existing navigation and export consumers.

## Known bugs, technical debt and TODO

- Source declarations do not verify original media SHA or processed frame cadence. UI reports playback timing unverified; no processed-frame accuracy claim is established.
- Schema 1 supports 24/25/30 non-drop source clocks; fractional/drop formats and physical latency measurements are deferred.
- Existing share creation has no atomic idempotency key or permanent version pin. Native publisher reconciles equivalent links and refuses assets with additional versions.
- Hosted cutover, actual native upload/storage/worker/guest acceptance and real production footage remain pending. Database backup/restore and additive migrations were verified on an isolated restored copy; see docs/rehearsal-cutover.md.

## Recent changes

2026-10-04
- Prepared isolated source integration branch from upstream 1ecede3, preserving the dirty hosting checkout. Added strict immutable rehearsal metadata, duplicate-safe allocation and tombstones, exact comment anchors, guest metadata authorization and source/cue review UI.
- Corrected ORM share password-protection status without schema or password-validation changes. Existing ordinary uploads and shares retain their contracts.
- All three additive integration migrations have been applied to isolated test and restored-copy databases only. Hosted services and live database have not been changed.
- Native generated Signal Garden 495-frame export metadata passed this source schema with exact source phase 1919/1920; the fixture contains no recorded MA cues. Generated cue/unit tests cover repeated occurrences separately.

## Local development

Copy .env.example to a private .env, then use docker compose -f docker-compose.dev.yml up --build. API commands: python -m pytest apps/api/tests/ -v (mock fixtures; real_db requires isolated Postgres); alembic upgrade head from apps/api. Web: pnpm --filter web test, pnpm --filter web exec tsc --noEmit, pnpm --filter web build. Consult AGENTS.md and docs/architecture.md for repository commands and boundaries.

## Troubleshooting

Use a dedicated test database for real_db tests and run test migrations there; never point acceptance at the live database. Set STALE_UPLOAD_TIMEOUT_HOURS=24 for the standard cleanup tests (a local .env value of zero disables cleanup and causes unrelated failures). Preserve multipart identity for explicit resume; content conflicts return 409 and purged allocations return 410. Do not recreate deleted versions or treat processing-ready as timing-verified.

2026-10-04 verification checkpoint
- Isolated integration API: 798 passed, 3 skipped. Final web: 662 passed; TypeScript and production Next.js build passed with one build worker and 512 MiB JavaScript heap. No type checking was bypassed.
- Prevented cue selection from moving a pending drawing or silently stripping its cue anchor. Drawing/cue composition regression passes.
- Live backup restored successfully and all three migrations passed on the restored copy with existing user/project/asset/version/comment counts preserved. Hosted services and live migration head remain unchanged. See docs/rehearsal-cutover.md for cutover and rollback boundaries.
