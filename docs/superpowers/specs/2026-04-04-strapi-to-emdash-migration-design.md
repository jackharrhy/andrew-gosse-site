# Design: Strapi → EmDash Migration

**Date:** 2026-04-04
**Status:** Approved

## Overview

Migrate the Andrew Gosse Composer site from a two-process stack (Strapi CMS + Astro SSR) to a single Astro process using EmDash as an embedded CMS integration. The `strapi/` directory and `strapi` Docker Compose service are removed entirely. EmDash provides the admin panel, media library, and database-backed content collections, all running inside the existing Astro site on the Node.js adapter.

## Architecture

### Before

```
compose.yml
  strapi (Node/SQLite, port 1338) ←─ GraphQL ─→ astro-site (Node/SSR, port 4322)
```

### After

```
compose.yml
  astro-site (Node/SSR, port 4322)
    └── EmDash integration (SQLite, admin at /_emdash/admin)
```

**What is removed:**
- `strapi/` directory (entire Strapi app)
- `strapi` service from `compose.yml`
- `astro-site/src/graphql/` directory (generated GraphQL types + execute helpers)
- `astro-site/src/lib/fetch-strapi.ts`
- `astro-site/src/consts.ts` (`strapiUrl`, `externalStrapiUrl`)
- `astro-site/codegen.ts` and `@graphql-codegen/*` dev dependencies
- `STRAPI_URL` / `EXTERNAL_STRAPI_URL` environment variables

**What is added:**
- `emdash` and `emdash/astro` npm packages
- `better-sqlite3` dev dependency (migration script only)
- EmDash integration in `astro.config.mjs`
- `astro-site/src/lib/fetch-emdash.ts` — typed wrappers around `getEmDashCollection`
- Rewritten `BlockRenderer.astro` — same render logic, updated for Portable Text block shape
- `scripts/migrate-from-strapi.ts` — one-time migration script reading from `tmp/backups/`
- `EMDASH_SECRET` environment variable (production session signing)
- `emdash_data/` bind mount in `compose.yml` for SQLite DB and media files

## EmDash Collections

### Single Types

**`homepage`**
| Field | Type | Notes |
|---|---|---|
| `seo.metaTitle` | string | required |
| `seo.metaDescription` | text | |
| `seo.shareImage` | media | |
| `blocks` | Portable Text | custom block types: media, richText, specialComponent |

**`sidebar`**
| Field | Type | Notes |
|---|---|---|
| `topImage` | media | |
| `categories` | repeatable component | see sidebar-category below |
| `links` | repeatable component | see sidebar-link below |

`sidebar-category` component: `categoryTitle` (string), `backgroundImage` (media), `items` (repeatable: `text` string, `page` relation → page)

`sidebar-link` component: `service` (string), `url` (string)

Note: `listAdornments` from the Strapi sidebar is dropped — it is not referenced in any rendered component.

**`site`**
| Field | Type | Notes |
|---|---|---|
| `backgroundColor` | string | hex color, e.g. `#f5f0eb` |

### Collection Type

**`page`**
| Field | Type | Notes |
|---|---|---|
| `slug` | string | required, unique, `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `seo.metaTitle` | string | |
| `seo.metaDescription` | text | |
| `seo.shareImage` | media | |
| `blocks` | Portable Text | same custom block types as homepage |

### Removed Collection

**`adornment`** — eliminated as a standalone collection. Adornments are embedded directly as an array within the `media` Portable Text block, removing a relational join that existed purely as a Strapi modeling artifact.

## Custom Portable Text Block Types

Registered with EmDash via the `definePlugin` / custom blocks API.

### `media`

```typescript
{
  _type: "media",
  file: { url: string; alt: string },
  width?: string;
  height?: string;
  padding?: string;
  margin?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  rotation?: number;
  border?: string;
  filter?: string;
  adornments?: Array<{
    file: { url: string; alt: string };
    width?: string;
    height?: string;
    padding?: string;
    margin?: string;
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
    rotation?: number;
    border?: string;
    filter?: string;
  }>;
}
```

### `richText`

```typescript
{
  _type: "richText",
  body: string; // markdown
}
```

### `specialComponent`

```typescript
{
  _type: "specialComponent",
  type: "riso_colors";
}
```

## BlockRenderer Changes

`BlockRenderer.astro` switches from Strapi's `__typename` discriminant to Portable Text's `_type`. The style-generation functions (`generateStyle`, `generateFilterStyle`, `generateContainerStyle`, `generateAdornmentStyle`) are unchanged. The only behavioral change: image `src` values no longer need an `externalStrapiUrl` prefix — EmDash serves media via its own URLs.

Before:
```astro
block.__typename === "ComponentSharedMedia"
src={`${externalStrapiUrl}${block.file!.url}`}
```

After:
```astro
block._type === "media"
src={block.file.url}
```

## Content Migration Script

**Location:** `scripts/migrate-from-strapi.ts`

**Runtime:** Node.js (tsx or ts-node), run once manually before cutover.

**Data source:** Reads directly from the backed-up SQLite database at `tmp/backups/andrewsite_strapi_data/data.db` using `better-sqlite3`. Media files are read from `tmp/backups/andrewsite_strapi_uploads/`. No network access to the live Strapi instance is required — the backup is the source of truth.

### SQLite schema notes

Strapi's SQLite layout requires a few joins to reconstruct content:

- **Published rows only** — pages, homepage, sidebar, and site all have draft duplicates. Filter with `WHERE published_at IS NOT NULL`. For pages, take the row with the highest `id` per slug among published rows (latest published wins).
- **Blocks** — stored in `*_cmps` join tables (e.g. `pages_cmps`, `homepages_cmps`). Each row has `entity_id`, `cmp_id`, `component_type` (`shared.rich-text`, `shared.media`, `shared.special-component`), and `order`. Sort by `order` to reconstruct block sequence.
- **Media files** — linked via `files_related_mph` (`related_id` = component id, `related_type` = `'shared.media'`, `field` = `'file'`). Join to `files` table for `url` and `name` (alt text).
- **Adornments** — `components_shared_media_adornments_lnk` links a `media_id` → `adornment_id`. Each adornment row in `adornments` joins to `adornments_cmps` (its own `shared.media` component) → `components_shared_media` → `files_related_mph` → `files`.
- **Sidebar** — `sidebars_cmps` holds category and link components. Category items are in `components_shared_sidebar_categories_cmps` → `components_shared_sidebar_items`, which link to pages via `components_shared_sidebar_items_page_lnk`.
- **SEO** — stored as a `shared.seo` component in the same `*_cmps` table with `field = 'seo'`. Its share image is linked via `files_related_mph` with `related_type = 'shared.seos'`.

### Steps

1. **Copy media files** — copy original (non-resized) files from `tmp/backups/andrewsite_strapi_uploads/` directly into the EmDash data directory (skipping Strapi's `large_`, `medium_`, `small_`, `thumbnail_` prefixed variants — EmDash handles its own resizing). Build a `strapiPath → localPath` map (e.g. `/uploads/foo_abc123.jpg` → copied file path).
2. **Upload to EmDash** — POST each copied file to EmDash's media library API; build a `strapiPath → emdashUrl` lookup map.
3. **Seed content** in dependency order:
   - `site` (query `sites` where `published_at IS NOT NULL`, take highest `id`)
   - `pages` (query `pages` where `published_at IS NOT NULL`, deduplicate by slug taking highest `id`, reconstruct blocks via join chain)
   - `sidebar` (query `sidebars` where `published_at IS NOT NULL`, reconstruct categories/items/links)
   - `homepage` (query `homepages` where `published_at IS NOT NULL`, take highest `id`, reconstruct blocks)

**Idempotency:** Before inserting each document, the script checks if it already exists (by slug for pages, by collection name for single types). Existing records are skipped, not duplicated. Safe to re-run.

**Block conversion:** The script converts Strapi component rows to Portable Text blocks:
- `shared.media` → `{ _type: "media", file: { url: emdashUrl, alt }, ...layoutProps, adornments: [...] }`
- `shared.rich-text` → `{ _type: "richText", body }`
- `shared.special-component` → `{ _type: "specialComponent", type }`

## Infrastructure

### compose.yml (after)

```yaml
services:
  site:
    build: ./astro-site
    ports:
      - "127.0.0.1:4322:4321"
    environment:
      - EMDASH_SECRET=${EMDASH_SECRET}
    volumes:
      - ./emdash_data:/app/data
```

### astro.config.mjs (after)

```typescript
import emdash from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
  integrations: [
    emdash({ database: sqlite("./data/emdash.db") }),
    metaTags(),
  ],
  adapter: node({ mode: "standalone" }),
  output: "server",
  vite: { plugins: [tailwindcss()] },
});
```

### Environment Variables

| Variable | Before | After |
|---|---|---|
| `STRAPI_URL` | required | removed |
| `EXTERNAL_STRAPI_URL` | required | removed |
| `EMDASH_SECRET` | — | required (production) |

## Data Fetching (after migration)

All Strapi GraphQL calls replaced with EmDash collection queries:

```typescript
// fetch-emdash.ts
import { getEmDashCollection, getEmDashEntry } from "emdash";

export async function fetchHomepage() {
  return getEmDashEntry("homepage");
}

export async function fetchPages() {
  const { entries } = await getEmDashCollection("pages");
  return entries;
}

export async function fetchPage(slug: string) {
  const { entries } = await getEmDashCollection("pages", { filters: { slug } });
  return entries[0] ?? null;
}

export async function fetchSite() {
  const [sidebar, site] = await Promise.all([
    getEmDashEntry("sidebar"),
    getEmDashEntry("site"),
  ]);
  return { sidebar, site };
}
```

## Out of Scope

- Cloudflare deployment (stays Node/Docker)
- EmDash plugin sandboxing (no plugins needed for this site)
- Comments, search, RSS, taxonomies (not in current Strapi schema)
- `tmp/emdash` local clone — using published npm package
