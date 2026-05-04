# Design: TeaCMS

**Date:** 2026-04-05
**Status:** Approved

## Context

The site is currently on a WIP branch using EmDash as a CMS. EmDash is early, fights the custom block editing needs, requires a complex build pipeline (`tmp/emdash-packs/`), and adds significant overhead for a single-site, two-user deployment. The production site still runs Strapi — nothing has shipped yet.

TeaCMS replaces EmDash with a minimal bespoke CMS that lives entirely inside `src/tea/`. It uses BlockNote for rich editing, Astro API endpoints for the backend, `better-sqlite3` for storage, and plain React for the admin SPA. No abstraction layers. No schema builder. No packages to maintain.

## Goals

- A friendly editing experience for a non-dev user (Andrew's friend)
- BlockNote as the page editor — Notion-style, inline, no dialogs
- Custom block types for media (with adornments) and special components
- Media upload + management
- Sidebar, site config, and adornment library editors
- Session auth with email + password (two users)
- Single SQLite file, no migrations, no revisions
- Auto-save — no Save/Publish distinction

## Architecture

```
src/
  tea/
    db/
      schema.ts        — CREATE TABLE IF NOT EXISTS statements, run on startup
      client.ts        — singleton better-sqlite3 connection (data/tea.db)
    api/
      auth.ts          — login/logout/me handlers
      pages.ts         — CRUD for pages
      homepage.ts      — get/update homepage
      sidebar.ts       — get/update sidebar
      site.ts          — get/update site config
      adornments.ts    — CRUD for adornment library
      media.ts         — upload, list, update, delete, serve file
    admin/
      App.tsx          — React SPA root, client-side routing, auth gate
      components/
        Layout.tsx       — admin shell (nav, header)
        Login.tsx        — login form
        Dashboard.tsx    — links to all editors
        PageList.tsx     — list pages, link to editor
        PageEditor.tsx   — BlockNote editor + SEO panel
        HomepageEditor.tsx — BlockNote editor
        SidebarEditor.tsx  — categories/links/image editor (ported from plugins/)
        SiteEditor.tsx     — background color picker
        AdornmentLibrary.tsx — adornment CRUD (ported from plugins/)
        MediaBrowser.tsx   — file grid, upload, select
        SeoAudit.tsx       — SEO coverage table (ported from plugins/)
        blocks/
          MediaBlock.tsx    — custom BlockNote media block editor
          SpecialBlock.tsx  — custom BlockNote special component block
        shared/
          ImagePicker.tsx   — reused across editors
          Repeater.tsx      — reused in SidebarEditor
    middleware.ts      — protects /_tea/admin/* routes
    auth.ts            — bcrypt password check, signed session cookie helpers

  pages/
    _tea/
      [...admin].astro — serves admin SPA (client:only React, auth-protected)
      api/
        auth/[...path].ts
        pages/[...path].ts
        homepage/[...path].ts
        sidebar/[...path].ts
        site/[...path].ts
        adornments/[...path].ts
        media/[...path].ts

  lib/
    fetch-tea.ts       — replaces fetch-emdash.ts, direct better-sqlite3 reads from tea.db

  types/
    blocks.ts          — replaces types/emdash.ts, BlockNote-native block types

  components/
    BlockRenderer.astro — updated to render BlockNote JSON (stays, renderer changes)
    Sidebar.astro       — updated to read from fetch-tea.ts (stays, minimal changes)
    Layout.astro        — stays, reads site config from fetch-tea.ts
    RisoColors.astro    — stays unchanged
```

**Removed entirely:**
- `plugins/content-blocks/` — all editor components move to `src/tea/admin/components/`
- `src/live.config.ts`
- EmDash integration from `astro.config.mjs`
- `emdash`, `@emdash-cms/admin` npm deps
- `scripts/update-emdash.sh`, `tmp/emdash*`
- `data/emdash.db` → replaced by `data/tea.db`
- `src/lib/fetch-emdash.ts` → replaced by `src/lib/fetch-tea.ts`
- `src/types/emdash.ts` → replaced by `src/types/blocks.ts`

## Database Schema

Single file: `data/tea.db`. Schema applied via `CREATE TABLE IF NOT EXISTS` on startup.

```sql
-- Auth
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Media
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,       -- relative to data/uploads/
  alt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Adornment library
CREATE TABLE IF NOT EXISTS adornments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  css TEXT NOT NULL DEFAULT '{}',  -- JSON: { width, height, top, right, bottom, left, rotation, border, filter, padding, margin }
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Singletons
CREATE TABLE IF NOT EXISTS site (
  id TEXT NOT NULL DEFAULT 'site' PRIMARY KEY,
  background_color TEXT NOT NULL DEFAULT '#f2f2f2',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sidebar (
  id TEXT NOT NULL DEFAULT 'sidebar' PRIMARY KEY,
  top_image_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  categories TEXT NOT NULL DEFAULT '[]',  -- JSON
  links TEXT NOT NULL DEFAULT '[]',       -- JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS homepage (
  id TEXT NOT NULL DEFAULT 'homepage' PRIMARY KEY,
  blocks TEXT NOT NULL DEFAULT '[]',  -- BlockNote JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pages
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  blocks TEXT NOT NULL DEFAULT '[]',  -- BlockNote JSON
  seo_title TEXT,
  seo_description TEXT,
  seo_image_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  seo_no_index INTEGER NOT NULL DEFAULT 0,
  seo_canonical TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Block Schema

BlockNote stores blocks as JSON arrays. Each block has `id`, `type`, `props`, `content`, `children`.

**Native BlockNote blocks used:**
- `paragraph` — body text
- `heading` (level 1–3)
- `bulletListItem`, `numberedListItem`
- `quote`, `code`
- `image` — built-in BlockNote image block (uses URL, not media ID)

**Custom blocks:**

`media` — full image with CSS layout and adornment refs:
```typescript
props: {
  mediaId: string;         // references media.id
  alt: string;
  width: string;
  height: string;
  padding: string;
  margin: string;
  top: string; right: string; bottom: string; left: string;
  rotation: string;        // degrees as string e.g. "-2"
  border: string;
  filter: string;
  adornments: string;      // JSON: Array<{ adornmentName: string }>
}
```

`special` — built-in site components:
```typescript
props: {
  type: "riso_colors";
}
```

**Server-side rendering:** `BlockRenderer.astro` gets a custom recursive renderer for BlockNote JSON. For rich text (paragraph, heading, etc.) it renders HTML directly. For `media` it resolves `mediaId` to a URL and renders with CSS. For `special` it renders the appropriate component. `@blocknote/server-util` provides `blocksToFullHTML()` as a fallback option.

## API Endpoints

All under `/_tea/api/`. Protected by session cookie except `GET /_tea/api/media/file/:id` and auth endpoints. Handlers are plain TypeScript functions called by Astro API route files.

### Auth
```
POST /_tea/api/auth/login     { email, password } → 200 { user } + Set-Cookie: tea-session=...
POST /_tea/api/auth/logout    → 200 + clears cookie
GET  /_tea/api/auth/me        → 200 { user } | 401
```

### Media
```
POST   /_tea/api/media           multipart { file, alt? } → 201 { id, url, filename, alt }
GET    /_tea/api/media           → 200 [MediaItem]
PUT    /_tea/api/media/:id       { alt } → 200 MediaItem
DELETE /_tea/api/media/:id       → 204
GET    /_tea/api/media/file/:id  serves binary (no auth, public)
```

### Pages
```
GET    /_tea/api/pages         → 200 [{ id, slug, title, seo_title, seo_description, updated_at }]
POST   /_tea/api/pages         { slug, title, blocks?, seo? } → 201 PageItem
GET    /_tea/api/pages/:slug   → 200 PageItem (full, with blocks)
PUT    /_tea/api/pages/:slug   { title?, blocks?, seo? } → 200 PageItem
DELETE /_tea/api/pages/:slug   → 204
```

### Singletons
```
GET /_tea/api/homepage        → 200 { blocks }
PUT /_tea/api/homepage        { blocks } → 200
GET /_tea/api/sidebar         → 200 { top_image, categories, links }
PUT /_tea/api/sidebar         { top_image_id?, categories?, links? } → 200
GET /_tea/api/site            → 200 { background_color }
PUT /_tea/api/site            { background_color } → 200
```

### Adornments
```
GET    /_tea/api/adornments      → 200 [AdornmentItem]
POST   /_tea/api/adornments      { name, media_id?, css } → 201 AdornmentItem
PUT    /_tea/api/adornments/:id  { name?, media_id?, css? } → 200 AdornmentItem
DELETE /_tea/api/adornments/:id  → 204
```

### Session cookie
- Name: `tea-session`
- Value: `<session-id>` (random 32-byte hex, stored in `sessions` table)
- HttpOnly, SameSite=Strict, Secure in prod
- 30-day expiry

## Admin UI

React SPA served by `src/pages/_tea/[...admin].astro` as `client:only`. Middleware redirects unauthenticated requests to `/_tea/admin/login`.

### Client-side routes
```
/login              — email + password form
/                   — dashboard with links to all editors
/pages              — page list
/pages/:slug        — page editor (BlockNote + SEO panel)
/homepage           — homepage editor (BlockNote)
/sidebar            — sidebar editor
/site               — background color
/adornments         — adornment library
/media              — media browser
/seo                — SEO audit
```

### Page editor
- BlockNote editor with native blocks + custom `media` and `special` blocks
- Auto-save on change, debounced 1500ms — no Save button needed
- "Saving…" / "Saved" indicator in header
- SEO panel below editor: title, description, image picker (opens MediaBrowser), noindex toggle, canonical URL
- Clicking a `media` block opens an inline side panel with layout fields and adornment picker (not a dialog — inline, right of the editor)

### Components ported from `plugins/content-blocks/`
These are functionally identical but API calls switch from `@emdash-cms/admin` to `fetch('/_tea/api/...')`:
- `SidebarEditor` → `src/tea/admin/components/SidebarEditor.tsx`
- `AdornmentLibrary` → `src/tea/admin/components/AdornmentLibrary.tsx`
- `SeoAudit` → `src/tea/admin/components/SeoAudit.tsx`
- `ImagePicker` → `src/tea/admin/components/shared/ImagePicker.tsx`
- `Repeater` → `src/tea/admin/components/shared/Repeater.tsx`
- `ColorPicker` → `src/tea/admin/components/shared/ColorPicker.tsx`

## Site-side rendering

`src/lib/fetch-tea.ts` replaces `src/lib/fetch-emdash.ts`. All functions are synchronous `better-sqlite3` reads — no HTTP, no async:

```typescript
export function getPage(slug: string): TeaPage | null
export function getPages(): TeaPageSummary[]
export function getHomepage(): TeaHomepage
export function getSidebar(): TeaSidebar
export function getSite(): TeaSite
export function getAdornmentLibrary(): Map<string, TeaAdornment>
export function getMediaUrl(id: string): string  // → /_tea/api/media/file/:id
export function getSeo(page: TeaPage): TeaSeo
```

`src/pages/[...slug].astro` and `src/pages/index.astro` call these directly. `BlockRenderer.astro` receives BlockNote JSON blocks and renders them recursively.

## Migration

`scripts/migrate-from-strapi-to-teacms.ts` (new file, references `migrate-from-strapi-to-emdash.ts` for the Strapi join chain patterns).

Steps:
1. Create `data/tea.db` with schema
2. Create admin users from env vars `TEA_ADMIN_EMAIL_1`, `TEA_ADMIN_PASSWORD_1`, `TEA_ADMIN_EMAIL_2`, `TEA_ADMIN_PASSWORD_2`
3. Upload media files from `tmp/backups/andrewsite_strapi_uploads/` → `data/uploads/`, insert `media` rows
4. Seed adornments (same Strapi join chain, CSS stored as JSON object)
5. Seed site config
6. Seed pages — convert Strapi dynamic zone to BlockNote JSON:
   - `shared.rich-text` (markdown) → single `paragraph` block with text (good enough for migration; markdown renders as plain text, can be re-edited in BlockNote)
   - `shared.media` → custom `media` block with `mediaId` resolved from media map
   - `shared.special-component` → custom `special` block
7. Seed sidebar
8. Seed homepage (same block conversion)

`--reset` flag: `DROP TABLE IF EXISTS` + recreate schema + re-run all steps.

## Cutover plan

1. Build TeaCMS on this branch (`emdash` branch)
2. Run `migrate-from-strapi-to-teacms.ts --reset` against prod Strapi backup to produce `data/tea.db`
3. Pull any last-minute content from prod Strapi, re-run `--reset`
4. Deploy — `compose.yml` runs single Astro+TeaCMS service (same as today but no EmDash)
5. Archive `scripts/migrate-from-strapi-to-emdash.ts` and `scripts/migrate-from-strapi-to-teacms.ts` to `scripts/archive/` once prod is confirmed

## Dependencies added
- `@blocknote/core` — block schema, serialization
- `@blocknote/react` — editor React component
- `@blocknote/shadcn` — UI library (chosen over mantine because the site already uses Tailwind v4; no Mantine anywhere)
- `@blocknote/server-util` — server-side HTML rendering
- `bcryptjs` + `@types/bcryptjs` — password hashing
- `ulid` — already in scripts, add to main deps

## Dependencies removed
- `emdash` (file: dep)
- `@emdash-cms/admin` (file: dep)
- `@tiptap/extension-collaboration`, `@tiptap/y-tiptap`, `yjs`, `y-protocols` (EmDash peer deps)
- `astro-meta-tags` (can inline what we need)
- `@astrojs/react` — stays (needed for BlockNote admin)
- `react`, `react-dom` — stays

## Out of scope
- Real-time collaboration (single-user editing at a time is fine)
- Draft/publish workflow (save = live)
- Content versioning / revision history
- Multi-site support
- Scheduled publishing
- Comments
- Search
