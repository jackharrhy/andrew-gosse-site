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
- EmDash integration in `astro.config.mjs`
- `astro-site/src/lib/fetch-emdash.ts` — typed wrappers around `getEmDashCollection`
- Rewritten `BlockRenderer.astro` — same render logic, updated for Portable Text block shape
- `scripts/migrate-from-strapi.ts` — one-time migration script
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

**Steps:**

1. **Read from Strapi** — reuse the existing GraphQL queries from `fetch-strapi.ts` against the live Strapi instance
2. **Download media** — fetch all media files (page images, sidebar topImage, SEO share images, adornment images) to a local temp directory
3. **Upload to EmDash** — POST each file to EmDash's media library API; build a `strapiUrl → emdashUrl` lookup map
4. **Seed content** in dependency order:
   - `site` (backgroundColor)
   - `pages` (slug, seo, blocks) — must come before sidebar because sidebar category items reference page slugs
   - `sidebar` (topImage, categories with backgroundImages and page refs, links) — image URLs remapped via lookup
   - `homepage` (seo with shareImage, blocks converted to Portable Text) — image URLs remapped

**Idempotency:** Before inserting each document, the script checks if it already exists (by slug for pages, by collection name for single types). Existing records are skipped, not duplicated. Safe to re-run.

**Block conversion:** The script converts the Strapi dynamic zone array to Portable Text blocks:
- `ComponentSharedMedia` → `{ _type: "media", file: { url: remappedUrl, alt }, ...layoutProps, adornments: [...] }`
- `ComponentSharedRichText` → `{ _type: "richText", body }`
- `ComponentSharedSpecialComponent` → `{ _type: "specialComponent", type }`

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
