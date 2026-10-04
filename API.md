# Integration contract

## Interfaces and authentication

FastAPI exposes JSON HTTP endpoints and OpenAPI at `/openapi.json`, with an interactive
contract at http://localhost:8000/docs. Authenticated requests use
`Authorization: Bearer <access_token>`; refresh tokens use `/auth/refresh`.
Share links use their own capability token and optional password/session.
First-run account provisioning is `/setup/create-superadmin`; `/setup/status` reports
whether provisioning is available. Password login is `/auth/login`; magic-code login
uses `/auth/send-magic-code` then `/auth/verify-magic-code`.

## Examples

```http
GET /health
```

```json
{"status":"ok"}
```

```http
POST /projects
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{"name":"Playground","description":"Local media review","project_type":"personal"}
```

Returns a project object with its UUID, name, creator and timestamps (201).
Consult OpenAPI for exact schemas for all endpoints.

## Media and events

The upload sequence is
`POST /upload/initiate`, `POST /upload/presign-part`, direct S3 multipart PUTs,
then `POST /upload/complete`. `/upload/{version_id}/parts` supports resuming interrupted
uploads; `/upload/abort` handles explicit cancellation. S3 signatures target the browser
storage endpoint; server access uses the internal MinIO hostname.
`GET /events/{project_id}` is SSE and carries processing, comment and approval updates.
See `docs/architecture.md` for event examples and `docs/comment-export.md` for NLE formats.

## Errors, retries and rate limits

Typical errors: 401 unauthenticated, 403 denied, 404 absent, 422 schema validation,
429 rate limited. Error details are JSON; exact route behavior is defined by OpenAPI
and `apps/api/routers/`. Magic-code sending is limited to 5 attempts per 600 seconds;
verification and password login to 10 per 600 seconds. SSE clients reconnect automatically.
Resume uploads using their stored upload identity; avoid blind retries of creating endpoints.

## Versioning and change policy

Routes currently have no URL version prefix. Releases use immutable `vX.Y.Z` tags and
moving `stable`/`latest` branches. Changes to external contracts must update this file,
OpenAPI schemas and callers together, with migration/compatibility work documented.
Hosted ingress may proxy these routes under /api without changing their contracts.


## Rehearsal metadata (source implementation, not deployed)

Authenticated PUT/GET `/assets/{asset_id}/versions/{version_id}/rehearsal-metadata`
attach an immutable schema-1 `reapershow.review` manifest to a video version.
PUT requires editor membership and version ownership; GET requires viewer membership.
Response: `{metadata_hash, metadata, timing_verified: false}`. Source declarations
do not certify processed HLS timing. Same canonical content repeats safely; changed
content returns 409 and requires a new version. Missing assets/versions/metadata
return 404, insufficient permissions 403, invalid schema 422 and payload over 8 MiB
413. Authorized guests can read a filtered projection through
`GET /share/{token}/assets/{asset_id}/versions/{version_id}/rehearsal-metadata`,
subject to the existing share/session and version-visibility checks described below.

Manifest fields: format, schema_version, export_id, video_sha256, frame_count,
video_rate/timecode_rate `{numerator,denominator}`, drop_frame=false, clock_spans
`{id,clip_start,clip_end,source_start}`, cues `{id,clip_frame,clock_span_id,sequence,
cue,data_pool?,source}`. Counts/rates are canonical decimal strings. Ranges are
half-open, spans ordered/nonoverlapping, cues refer to covered frames and use stable
occurrence IDs. Timecode supports 24/25/30 non-drop in schema 1; video rate is distinct.
Clock gaps remain unmapped. Physical latency is not inferred. Unknown fields,
including local filesystem paths, are rejected.

## ReaperShow publication allocation (source implementation, 2026-10-03)

`POST /integrations/reapershow/publications` requires authenticated editor access
to a live project. Supply the existing upload initiation fields and UUID
`producer_id`, opaque `recording_id`, `take_id`, `export_id` (1–128 ASCII
letters/digits/underscore/dot/colon/hyphen), and lowercase SHA-256
`export_sha256`. Only MP4 is accepted; `original_filename` must be a basename. An optional
existing target must be a live video asset in the same project; non-video targets
are rejected with 422 before multipart allocation. Asset names contain 1–255 characters.
The response is the existing multipart allocation receipt. Continue through
`/upload/presign-part`, `/upload/resume`, and `/upload/complete`.

The identity includes the uploader, destination project and all four producer
identifiers. Identical retries return the original receipt; any changed request
under that identity returns 409. Access is checked again on retries. A deleted
or purged version returns 410, never a fresh allocation. Choose a new export ID
for an intentionally new publication. PostgreSQL transaction advisory locking
serializes allocation across API processes. Purge retains the opaque identity
receipt as a tombstone. The declared SHA-256 does not certify stored media.
No integration routes have been deployed to the hosted instance yet.

## Rehearsal review comments and guest timeline (source, 2026-10-03)

Authenticated and guest comment creation accept optional `clip_frame` (canonical
nonnegative decimal string), `cue_occurrence_id`, and
`rehearsal_metadata_hash` (lowercase SHA-256). Frame and hash are required together.
The server validates them against the target version's immutable timeline; cue
anchors must match an occurrence at that exact frame. Missing/stale metadata is
409, invalid frame/cue is 422. The server derives legacy `timecode_start` seconds
from the authoritative frame and rational video rate. Integers are stored as
BIGINT and returned as decimal strings. Authenticated replies validate and persist
anchors against the parent comment’s version, regardless of the supplied version ID.
Ordinary comments are unchanged.

`GET /share/{token}/assets/{asset_id}/versions/{version_id}/rehearsal-metadata`
uses the existing password/session, expiration, visibility and asset-scope checks.
Only ready, visible versions are returned; hidden history is 404. The guest
projection excludes export ID and video hash. Guest anchored comments additionally
validate the ready version and the share's version visibility.

A clock span can carry `source_phase: {numerator, denominator}` as decimal
strings, defaulting to 0/1. It is the exact fractional LTC frame at the clip
span's first picture; 0 <= numerator < denominator <= 1,000,000,000. Include it
when, for example, a 50 fps trim begins halfway through a 25 fps label. Source
labels floor the sum of phase and elapsed rational frames; they never discard
phase before adding the elapsed frames.

### Share inventory protection flag (source, 2026-10-04)

ORM-backed create/list share responses now derive `has_password` from the presence of the existing password hash. This corrects the response's former false fallback for protected links without returning password hashes, decrypted values or changing password validation. ReaperShow uses this flag when reconciling links with comments enabled, downloads disabled and no password/expiry. This response-only property adds no database column or migration; hosted images have not been rebuilt.
