# CSLD rehearsal publishing cutover

## Prepared source and limits

The integration branch adds idempotent publication allocation, upload resume, immutable rehearsal metadata, cue/frame comment anchors and review UI. ReaperShow creates comment-enabled, download-disabled links once processing reports ready. Playback timing remains unverified: declared clock frames are exact rational source metadata, but processed picture cadence and original-media hash are not yet verified by the server.

This integration checkout does not include the existing CSLD hosting, Microsoft 365 mailer or thumbnail repairs. Do not replace the hosted stack with images built solely from this branch. First prepare and review a composed source tree that retains that baseline. Keep private configuration, credentials and media out of Git. Live database migration and service replacement are separate approval gates.

## Backup and migration rehearsal completed on 2026-10-04

- Live baseline migration: e3f5a7c9d1b2.
- Private PostgreSQL custom-format backup: original hosting checkout `.local/hosting/backups/pre-rehearsal-20261004.dump`; directory is owner-only and file was created with umask 077.
- Restore was tested in a newly created isolated database; no existing database was overwritten.
- Additive migrations passed in order: a91b2c3d4e5f (rehearsal metadata), b92c3d4e5f60 (publication allocations), c03d4e5f6071 (nullable comment anchors).
- Restored head: c03d4e5f6071. Users/projects/assets/versions/comments remained 1/1/1/1/1. Metadata/allocation tables were empty and all three new comment columns existed.
- Live database remained at e3f5a7c9d1b2. Media storage and running services were unchanged.

## Required cutover steps

1. Review the integration PR alongside the existing hosting baseline. Stage immutable API/worker and web artifacts from the composed source. Record exact source hashes and image digests plus the currently running image digests.
2. Verify composed-source API tests include the Microsoft 365 and thumbnail regressions. Build the web with a single worker within the current Docker memory limit; do not change host resources or bypass type checks.
3. Immediately before the approved maintenance window, make a fresh database backup and confirm the existing media volume remains retained. No bucket policy, tunnel, credential, authentication or volume replacement is required for this integration.
4. Pause upload activity/processing for the maintenance window. Run only the three reviewed additive migrations using the existing host configuration and the staged API image. Verify migration head and existing row counts.
5. Replace only API, processing/email/maintenance workers and web with the recorded composed artifacts. Preserve existing PostgreSQL, Redis, MinIO volumes, proxy, tunnel, secret files and sender configuration.
6. Check API health, ordinary login mail from no-reply@csld.co.uk, existing asset playback and background processing before the rehearsal trial.
7. In the native app, sign in privately, select the project and publish the generated rehearsal take. Verify actual presigned storage transport, worker ready state, source-clock display and separate repeated cue occurrences. Open the resulting link as a guest: comments work, downloads are refused, historical versions are hidden, and a saved cue comment retains its frame/cue/hash anchor. Test pause/resume and duplicate allocation using disposable assets.
8. Record native, API/storage, worker and guest evidence separately. Real footage and processed-frame verification remain outstanding until explicitly exercised.

## Rollback

If acceptance fails, pause publication and restore the previously recorded API/worker/web artifacts. Prefer leaving the additive schema in place so new review comments and receipts are not lost. Do not automatically run down migrations, delete new assets, replace media volumes or overwrite the live database. A full database restore requires a separately reviewed recovery decision using the verified private backup.
