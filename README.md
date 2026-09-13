# Andrew Gosse / TeaCMS

The public website and its CMS run entirely on **Remix 3.0.0-rc.1**, including
Remix's UI runtime, router, asset server, Node adapter, and SQL migration workflow.
There is no Astro, React, React Router, or BlockNote runtime dependency.

## Local workspace

Use Node **24.3 or newer**. The primary checkout is
`/home/jack/repos/personal/andrew-gosse-site` on `remix3-tea`, tracking
`origin/remix3-tea`. The separate Remix worktree has been retired.
The earlier implementation remains on `tea-cms`; its local fixture and build
files were preserved in a sibling `andrew-gosse-pre-remix-20260913-*` backup.

```sh
npm ci
npm run db:migrate
npm run dev
```

Development binds to `127.0.0.1:4331`. The configured tailnet preview is
<https://newport.hedgehog-python.ts.net:8450/>; its CMS is `/tea/admin`.
Use the existing TeaCMS login from the copied fixture. Credentials have not changed.

Copy `.env.example` to `.env` when configuring another machine. Set `APP_ORIGIN`
to the exact HTTPS preview or production origin. Cookie security and write-origin
checks use that value. Keep it unset for plain loopback HTTP development.

For a new installation, run `npm run tea:seed-users` with `TEA_ADMIN_EMAIL` and
`TEA_ADMIN_PASSWORD` in ignored configuration. The command refuses to overwrite
an existing account. Public startup does not create accounts or reset credentials.

## Editing

- Page and homepage block editing: rich text, headings, lists, quotes, images,
  Markdown/HTML embeds, dividers, and Andrew's Riso color palette.
- Visual adornment positioning over real images, with drag, size and angle controls.
  Add multiple copies of artwork; edit, duplicate or remove each placement independently.
  Image-specific placements stay in the page draft; shared library changes use an explicit save.
- Image tilt and border controls share rendering rules with the public website.
  The canvas scales the actual preview layout, keeping pixel borders and adornments in proportion.
- Full-height website preview with a draggable divider and Mobile/Wide presets.
  Collapse CMS navigation or reduce the editor to a narrow rail.
  Pane widths and navigation visibility are remembered locally; narrow editors use container queries.
- Draft autosave, a separate Publish action, manual save / Ctrl or Cmd+S, stale-write
  rejection, undo/redo, local draft recovery, and earlier saved versions.
- Non-reloading live draft preview, left-side block drag handles (also keyboard accessible), search metadata, sharing images, and indexing controls.
- Searchable media library, folders/subfolders, private notes, alternative text,
  an adornment-artwork collection, uploads, and usage-aware removal.
- Sidebar categories, page ordering, external links, site identity, and colors.

New pages and homepage/page edits stay private until **Publish**. Autosave and
Ctrl/Cmd+S save drafts only. The preview updates while typing, even with autosave off.
Navigation, site settings, media details and shared adornments still use explicit
save actions; they are not part of a page draft.
Unknown block properties survive saves. The editor intentionally supports the
site's existing content format rather than converting everything to another editor schema.
Rich text uses TipTap 3 without a React adapter. Domain blocks remain native Remix
controls, preserving the existing content format. Imported Markdown/HTML remains
an explicit source field so its styling and embeds survive.

Media removal unlists the record and retains its bytes and history for recovery.
Referenced media and adornments cannot be removed. Site-managed media URLs remain
`/tea/api/media/file/:id`, and all existing public page slugs are preserved.

## Data and migration

Runtime data is ignored: `data/tea.db` and `data/uploads/`, overridden together by
`TEA_DATA_DIR`. Remix SQL migrations live in `db/migrations/`. They support both
an empty database and adoption of the original Tea tables. Additional tables hold
editor history, page drafts, media folders/notes, and site preferences without
rewriting the original content.

To create an independent fixture, supply an existing source and a **new** target:

```sh
node scripts/copy-fixture.ts /path/to/source/data /path/to/new/fixture
npm run tea:parity -- /path/to/source/data /path/to/new/fixture
```

The copy uses SQLite's backup API, including committed WAL contents. Do this while
editing/uploads are quiescent so the database and upload directory describe the
same point in time. Parity checks compare all original table rows and upload hashes.
They are expected to differ after intentional edits.

For Strapi backups, import into a new scratch/staging directory:

```sh
npm run tea:import -- --source-db /path/to/backup/data.db --source-uploads /path/to/backup/uploads --target-dir /path/to/new/tea-data
npm run tea:verify-import -- data /path/to/new/tea-data
```

The importer refuses to overwrite an existing directory. Verification compares
content, references, and media hashes while allowing newly generated IDs.
The existing local backup was rehearsed successfully: 21 pages, 73 media files,
13 adornments, and the homepage/sidebar all matched the Tea reference.

The default canonical origin is `https://andrewgossecomposer.com`, matching Mug's
existing Traefik router. Changing CMS metadata does not change hostname routing.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run tea:verify-preview -- http://127.0.0.1:4331
```

`build` typechecks and compiles the browser module graph in production mode.
Remix serves TypeScript directly; there is no generated server bundle.
`npm start` exercises the production runtime.

Server tests use temporary databases. Browser tests create synthetic content and
a test-only account; no private fixture is required. To additionally verify real
content, run `E2E_FIXTURE_DIR=data npm run test:browser`. That option creates an
independent SQLite/upload backup and never edits the source directory.
Screenshots and traces are ignored under `tmp/` and `test-results/`.
Set `E2E_BASE_URL` and `APP_ORIGIN` to a scoped HTTPS test preview to repeat the
browser suite through Tailscale Serve. The suite was verified through HTTPS too.

See [the thermonuclear review](docs/thermonuclear-review.md) for findings, fixes,
and remaining release cautions.

## Container and production

The Dockerfile uses Node 24, runs as `node`, exposes port 4331, and has `/healthz`.
Mount `TEA_DATA_DIR` at `/app/data` with write access for UID 1000. Runtime data,
backups, local configuration, and Git metadata are excluded from the image.
The container listens on `0.0.0.0` **inside its network namespace**; publish local
test ports only on loopback, or use the private reverse-proxy network in production.

Production remains the legacy Astro + Strapi service on Mug. No production
deployment or hostname change is part of this checkout. See
[the rollout and rollback plan](docs/remix3-rollout.md) before deploying.
