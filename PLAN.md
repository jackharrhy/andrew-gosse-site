# TeaCMS Remix 3 Rewrite Plan

## Implementation status — 2026-09-13

The rewrite now occupies the primary checkout on `remix3-tea` at
`/home/jack/repos/personal/andrew-gosse-site`. The separate Remix worktree is
retired. The earlier code remains on `tea-cms`, with its local files preserved
in a sibling `andrew-gosse-pre-remix-20260913-*` backup. The configured Remix preview is
`https://newport.hedgehog-python.ts.net:8450/`, with the CMS at `/tea/admin`.

- Full pinned Remix 3 runtime, native UI editor, SQL migrations, authentication,
  public rendering, and all seven CMS slices are implemented.
- The independent fixture preserves all eight original tables and all 73 upload
  hashes. The Strapi import rehearsal matches the reference content and media.
- Automated server/browser tests, production asset compilation, private HTTPS
  editing, and a mounted-data container smoke test verify the implementation.
- The native site-specific editor replaces BlockNote and uses framework-free
  TipTap for rich text. Existing block JSON and unknown properties are retained.
  Page edits save as private drafts; publishing is a separate action.
- `andrewgossecomposer.com` matches the existing Mug router and is the canonical
  default. Production routing has not changed.
- Production deployment remains separately approved. Follow
  [the rollout plan](docs/remix3-rollout.md), not the historical setup below.

The remaining sections record the original specification and reference setup.
See [README.md](README.md) for current commands, layout, and verification.

## Goal

Replace the current Astro + embedded React-admin TeaCMS implementation with a hand-owned, full-stack TeaCMS app using the full `remix@3.0.0-rc.1` release candidate. Preserve the existing SQLite content, uploaded media, public URLs, and tailnet-only local development workflow.

Historical reference setup before the Remix rewrite:

- Repository: `/home/jack/repos/personal/andrew-gosse-site`
- Active branch: `tea-cms`, tracking `origin/emdash`
- Local fixture: `data/tea.db` and `data/uploads/`
- Raw production backup: `tmp/backups/`
- Local preview: `https://newport.hedgehog-python.ts.net:8449/`

The current live Mug site remains the legacy Astro + Strapi deployment. Do not touch production during this rewrite.

## Technology Choice

Use the full `remix@3.0.0-rc.1` package with its default runtime, CLI, router, and database workflow. Pin the exact release-candidate version.

Do not build another Astro integration, React Router application, or Remix v2 compatibility project. The CMS is a full-stack application: public rendering, authentication, forms, database reads/writes, and administration should share one framework boundary.

Remix 3 is prerelease software. Keep this `tea-cms` branch runnable as the implementation reference until the new app achieves local parity.

Reference: https://remix.run/blog/remix-3-release-candidate

## Product Principles

1. TeaCMS is site-specific, not a generic headless CMS.
2. Prefer small readable controllers and domain modules over generated or opaque abstractions.
3. Preserve existing content and URLs before improving the editor.
4. Keep the current SQLite database and upload layout as the initial data contract.
5. Keep local development loopback-bound and exposed only through scoped Tailscale Serve routes.
6. Do not cut over production until local parity and a reversible deployment plan are complete.

## Target Shape

Use the Remix 3 RC template conventions, adapting names only after checking the generated project:

```text
app/
  db/                 SQLite connection, schema, migrations, seeds
  domain/
    auth/             users, sessions, password verification
    content/          pages, homepage, sidebar, site settings
    media/            uploads, MIME validation, file lookup
    adornments/       adornment library and style data
  routes/
    public/           homepage and page controllers
    admin/            protected CMS controllers
    api/              narrow JSON/media endpoints where needed
  ui/
    public/           public layout and block rendering
    admin/            CMS controls and editor integration
  tests/
data/
  tea.db
  uploads/
```

Keep these existing table/data contracts during the first rewrite: users, sessions, media, adornments, site, sidebar, homepage, and pages. Preserve media IDs and paths, block JSON, `/tea/admin`, and public page slugs such as `/gallery` and `/contact`.

## Phased Work

### 0. Freeze this reference

- Confirm this `tea-cms` checkout stays runnable with its ignored local fixture.
- Record row counts, public slugs, media paths, upload file count, and upload bytes.
- Create a separate future `remix3-tea` worktree only for the rewrite spike. It must use a copied fixture, leaving this checkout intact.

Acceptance: this branch remains a rollback/reference implementation and the new worktree has an independent local fixture.

### 1. Minimal Remix 3 RC app

- Generate the official Remix 3 RC app in the future rewrite worktree.
- Pin `remix@3.0.0-rc.1` in the lockfile.
- Add Node development, build, production-start, healthcheck, and test commands.
- Configure ignored SQLite and upload paths.
- Bind local development to `127.0.0.1`, never `0.0.0.0`.

Acceptance: dev, build, test, and production-start work against an empty local SQLite database.

### 2. Persistence and public rendering

- Establish a baseline migration matching the current Tea schema before schema redesign.
- Port SQLite read models for homepage, pages, sidebar, site configuration, media, and adornments.
- Begin every new behavior with a failing test using a temporary SQLite fixture.
- Port homepage, public slug pages, layout, metadata, sidebar, block renderer, and media delivery.
- Test missing slugs, missing media, MIME handling, and path traversal protection.

Acceptance: the Remix preview renders the homepage and every imported public page from the copied fixture; all stored media references resolve.

### 3. Authentication and administration

- Port explicit user lookup, bcrypt verification, sessions, expiry, logout, and secure cookies.
- Test valid/invalid login, expired session, logout, protected route redirect, and authenticated access.
- Retain `/tea/admin` as the initial admin path.
- Seed development users only from ignored configuration or an explicit local CLI command. Never commit credentials.

Acceptance: local tailnet login and protected admin access work end-to-end.

### 4. CMS vertical slices

Complete each slice fully, with test-first server/domain behavior and tailnet-preview verification, before starting the next:

1. Page list.
2. Page editor: edit title, SEO, blocks, save, reload, and verify public rendering.
3. Homepage editor.
4. Media browser: list, upload fixture media, retrieve it, delete test-only media.
5. Sidebar editor and public ordering verification.
6. Adornment library and rendering verification.
7. Site settings, canonical URLs, and generated metadata.

Do not carry React Router forward. The current BlockNote React editor requires a focused compatibility spike: either prove it is clean in Remix 3's default UI runtime, isolate only the editor renderer if justified, or choose a smaller domain-specific editor.

Acceptance: an authenticated editor can perform the core current TeaCMS edits without corrupting content, blocks, media, or navigation.

### 5. Parity and production readiness

- Add a repeatable parity script comparing fixture row counts, slugs, media IDs/paths, sidebar, and homepage blocks.
- Add route-level checks for public pages, media, admin, login, and an authenticated write/read cycle.
- Build and run the container with mounted data, never baked-in production state.
- Resolve the production canonical-hostname discrepancy between `andrewgosse.com` and `andrewgossecomposer.com`.
- Write a separate rollout plan before modifying Mug.

Acceptance: tests pass; the Remix app builds and serves real local content; a reversible production rollout plan exists.

## Later Production Cutover

This is explicitly separate from the rewrite:

1. Create a dated verified backup of Mug Strapi SQLite and uploads.
2. Generate the Tea production fixture using the validated migration path.
3. Add a new Remix service in `/home/jack/infra/hosts/mug/compose.yml` with explicit mounts for SQLite and uploads.
4. Test a tailnet-only/staging route before production hostname changes.
5. Verify public pages, media, admin login, and an editing round trip.
6. Obtain owner approval before hostname cutover.
7. Retain Strapi configuration, containers, SQLite, and uploads through an agreed rollback window.
8. Retire Strapi only as a separately approved change.

## Handoff Checklist

- Read this file and `docs/superpowers/` in the TeaCMS branch.
- Fetch `origin` before Git work.
- Keep this `tea-cms` reference checkout isolated from the future Remix worktree.
- Use test-first development for every new application behavior.
- Bind local previews to loopback and expose only through scoped Tailscale Serve.
- Ask before production deployment, hostname cutover, container retirement, data deletion, or credential changes.
