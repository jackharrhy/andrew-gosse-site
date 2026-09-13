# Production cutover — 2026-09-13

The owner approved downtime and replacement of the legacy Astro/Strapi site.
PR #18 merged the verified application into `main` as
`0aa00608f4855be86baf012313674eda7b175da3`.

## Running services

- Website: https://andrewgossecomposer.com
- CMS: https://andrewgossecomposer.com/tea/admin
- Host: Mug; public SSH fallback `jack@jackharrhy.dev`.
- Infra: `/home/jack/infra/hosts/mug/compose.yml`.
- Service: `andrewsite_remix`, internal port 4331, network `mug_web`.
- Image: `ghcr.io/jackharrhy/andrew-gosse-site@sha256:c0da7d16f35e515dcfffe8236f507be993e6c2d903c71e128998d0d01e5035ec`.
- Origin: `APP_ORIGIN=https://andrewgossecomposer.com`.
- Data: `/home/jack/infra/hosts/mug/volumes/andrewsite_tea_data`, mounted at
  `/app/data`, owned by UID 1000. Never replace this with the development fixture.
- `andrewsite_media` serves old `api.andrewgossecomposer.com/uploads/` URLs from
  the original upload volume read-only. Other API-host paths redirect to TeaCMS.
- Astro and Strapi are stopped and behind the `legacy-andrew` Compose profile.
  Their original volumes remain. Watchtower is disabled for these site services.

## Content and access

The final import came from a stopped, integrity-checked production Strapi
snapshot, not from local editor data. All 21 pages, the homepage, navigation,
site settings, 13 adornments and 73 media files matched the existing verified
reference after normalizing generated IDs. Original media bytes were preserved.

Two active Strapi super-admin accounts were carried over with their existing
bcrypt hashes. No sessions, reset tokens, development accounts or temporary
verification accounts were retained. TeaCMS has one full-editor permission level.

## Backups

- Final Strapi snapshot and imported archive on Mug:
  `/home/jack/andrewsite-cutover-20260913/`.
- Independent cutover copies on Newport:
  `/home/jack/repos/personal/andrew-gosse-site/tmp/cutover-20260913/`.
- Daily TeaCMS snapshots: `/home/jack/backups/andrewsite/` on Mug.
- Job: `/etc/cron.d/andrewsite-backup`, invoking the infra-managed
  `hosts/mug/andrewsite/backup.sh` at 04:17 server time, retaining roughly 14 days.
- Each archive contains a SQLite backup and uploads, with database integrity and
  archive-read checks. Media bytes are retained after unlisting, so copying the
  database before uploads preserves the files referenced by that snapshot.

Daily snapshots are host-local, not an off-host disaster-recovery service.
Keep the independent cutover copy; arrange recurring off-host replication separately.

## Release procedure

Production now follows the `:latest` image tag, as requested after the initial
cutover. Main-branch CI publishes both `:main` and `:latest`, but Watchtower remains
disabled for this site. Wait for application checks and image publication, then
run `docker compose pull andrewsite_remix` followed by
`docker compose up -d --no-deps --wait andrewsite_remix` from `~/infra/hosts/mug`.
No recurring Compose image edit is needed. Record the running digest before each
release so a routine app rollback can select the previous image without reverting
to Strapi or changing production data. Use service-scoped commands when unrelated
updates are not intended.

The final image does not include `scripts/`. Run import/verification tooling from
the matching source checkout, or mount that revision's scripts read-only into a
one-off container using the release image. The repository root Compose file is a
legacy local-development configuration, not the production deployment definition.

## Rollback

Freeze TeaCMS editing and back up its current data first. New TeaCMS edits do not
automatically flow back into Strapi. Reconcile those edits before promising a
lossless rollback.

Stop `andrewsite_remix` and `andrewsite_media`, then explicitly start
`andrewsite_astro` and `andrewsite_strapi` with the `legacy-andrew` profile. Do not
run both sets of hostname routers simultaneously. The original Strapi volumes and
legacy image references remain in infra; do not remove them during routine cleanup.

## Verification

PR and main CI passed, including 19 server tests, 18 browser checks, and production
asset compilation. The deployed image passed all 95 public page/media requests,
validation of all 22 documents, and anonymous CMS protection.

A disposable production browser check verified HTTPS login, Secure/HttpOnly
SameSite=Strict sessions, private drafts, live preview, save/reload, publish, the
real image editor, and desktop/mobile rendering. The temporary page and account
were removed afterward. Existing authored pages were not edited.
