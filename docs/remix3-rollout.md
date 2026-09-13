# Remix 3 rollout and rollback

Status: local rewrite verified; production changes require owner approval.

## Evidence and intended deployment

- App: `remix3-tea`, Node 24.3+, pinned `remix@3.0.0-rc.1`.
- Existing public host: `andrewgossecomposer.com`, established by the Traefik
  router in `/home/jack/infra/hosts/mug/compose.yml`. The old Astro `site` setting
  used `andrewgosse.com`; Remix now defaults metadata to the deployed host.
- Keep the legacy Astro and Strapi containers, configuration, SQLite, and uploads.
- Add a distinct Remix service only after approval. It needs a new bind-mounted
  data directory, UID 1000 write access, `APP_ORIGIN=https://andrewgossecomposer.com`,
  and port 4331 on the private proxy network. Do not attach its production router yet.
- Deploy one application process against its SQLite volume. Keep uploads and SQLite
  together in backups. Never mount the Strapi data volume as Remix's data directory.
- Pin the built image digest. Before production approval, review the RC's current
  release/security status and repeat all checks if the framework version changes.

## Before cutover

1. Agree on an editing freeze and a rollback window with the owner. Record who can
   end the freeze and who will decide whether the new editor is ready.
2. Make a dated, consistent backup of production Strapi SQLite and uploads during
   the freeze. Use SQLite's backup API or a stopped writer; do not copy only a live
   SQLite main file while ignoring its WAL. Verify the backup opens and files exist.
3. Run `tea:import` into a **new staging directory**. Do not overwrite any existing
   fixture or production directory. Retain the raw backup separately.
4. Check published page slugs and actual content against that fresh Strapi backup,
   including drafts/published selection, embeds, media, navigation, and adornments.
   The old local fixture is a useful regression reference, not the authority for
   edits made since that backup. `tea:verify-import` is exact only for matching snapshots.
5. Establish approved CMS editor accounts through the explicit seed command and
   ignored configuration. Do not assume Strapi admin credentials migrate into Tea.
6. Run the Remix service on a tailnet-only staging route. Set its exact HTTPS
   `APP_ORIGIN`, verify Secure/HttpOnly cookies, and repeat login, public rendering,
   upload, save/reload, and anonymous-write rejection. Exercise edits on disposable
   test content so the staged production content remains a faithful import.
7. Confirm all pages and media load, reference checks pass, the container healthcheck
   succeeds, and restart preserves saved data. Export the effective deployment config
   and record both old and new image digests and volume locations.
8. Present the concrete service/router change, verification results, canonical host,
   and rollback procedure to the owner for cutover approval.

## Cutover

Keep editing frozen. Change only the approved router/service association for the
existing public host; this is not a reason to change DNS or unrelated applications.
Check homepage, all public pages, canonical/OG metadata, original media URLs, admin
login, and a disposable editing round trip over the real hostname. Check logs and
restart once to prove persistence. End the editing freeze only after acceptance.

## Rollback

Before Remix editing is opened, revert the router to the unchanged Astro service
and verify the old public site and Strapi editor. No data conversion is necessary.

After Remix edits exist, freeze **both** editors first. Back up Remix SQLite and
uploads before reverting routing. A router rollback does not copy new Remix edits
back into Strapi. Inventory the changes from `content_history` and media records;
agree whether to replay them manually into Strapi or keep editing frozen while
repairing Remix. Never silently discard new content or assume restoring an old
database reconciles it.

Do not run down migrations or reset/import commands against production as a rollback.
Keep the new data snapshot, old Strapi data, and both application images through the
agreed window. Container retirement, data deletion, and credential changes each
remain separately approved operations.
