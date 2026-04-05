# Strapi → EmDash Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-process Strapi + Astro stack with a single Astro process using EmDash as an embedded CMS, migrating all content from the backed-up Strapi SQLite database.

**Architecture:** EmDash is added as an Astro integration backed by a local SQLite file. All Strapi GraphQL code is deleted and replaced with `getEmDashCollection` / `getEmDashEntry` calls. A one-time Node.js script reads from `tmp/backups/andrewsite_strapi_data/data.db` and `tmp/backups/andrewsite_strapi_uploads/`, uploads media to EmDash, and seeds all content collections.

**Tech Stack:** Astro 5, EmDash (npm), better-sqlite3, Node.js adapter, Tailwind CSS, Docker Compose.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `astro-site/astro.config.mjs` | Add EmDash integration, local storage adapter |
| Modify | `astro-site/package.json` | Add `emdash` dep; remove graphql-codegen deps |
| Create | `astro-site/src/live.config.ts` | Register EmDash loader as `_emdash` collection |
| Delete | `astro-site/src/graphql/` | Remove all generated GraphQL types + execute helper |
| Delete | `astro-site/src/lib/fetch-strapi.ts` | Remove Strapi GraphQL query functions |
| Delete | `astro-site/src/consts.ts` | Remove strapiUrl / externalStrapiUrl |
| Delete | `astro-site/codegen.ts` | Remove GraphQL codegen config |
| Create | `astro-site/src/lib/fetch-emdash.ts` | Typed wrappers around getEmDashCollection/Entry |
| Create | `astro-site/src/types/emdash.ts` | TypeScript types for block shapes and collection data |
| Modify | `astro-site/src/components/BlockRenderer.astro` | Switch from `__typename` to `_type`, remove strapiUrl prefix |
| Modify | `astro-site/src/components/Sidebar.astro` | Remove strapiUrl prefix from image src |
| Modify | `astro-site/src/layouts/Layout.astro` | Remove strapiUrl import, update fetchSite call |
| Modify | `astro-site/src/pages/index.astro` | Use fetchHomepage from fetch-emdash |
| Modify | `astro-site/src/pages/[...slug].astro` | Use fetchPage from fetch-emdash |
| Modify | `compose.yml` | Remove strapi service, add emdash_data volume |
| Modify | `astro-site/.env.dist` | Replace STRAPI_URL vars with EMDASH_SECRET |
| Create | `scripts/migrate-from-strapi.ts` | One-time migration script |
| Create | `scripts/package.json` | Script runner deps (better-sqlite3, tsx) |

---

## Task 1: Install EmDash and wire up the integration

**Files:**
- Modify: `astro-site/package.json`
- Modify: `astro-site/astro.config.mjs`
- Create: `astro-site/src/live.config.ts`

- [ ] **Step 1: Install emdash**

```bash
cd astro-site && npm install emdash
```

- [ ] **Step 2: Replace astro.config.mjs**

```javascript
// astro-site/astro.config.mjs
// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import metaTags from "astro-meta-tags";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: node({
    mode: "standalone",
  }),
  output: "server",
  integrations: [
    metaTags(),
    emdash({
      database: sqlite({ url: "file:./data/emdash.db" }),
      storage: local({
        directory: "./data/uploads",
        baseUrl: "/_emdash/api/media/file",
      }),
    }),
  ],
});
```

- [ ] **Step 3: Create live.config.ts**

```typescript
// astro-site/src/live.config.ts
import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

export const collections = {
  _emdash: defineLiveCollection({ loader: emdashLoader() }),
};
```

- [ ] **Step 4: Start dev server and confirm EmDash admin loads**

```bash
cd astro-site && npm run dev
```

Navigate to `http://localhost:4321/_emdash/admin` — you should see the EmDash setup screen (not a 404 or crash). The site itself will be broken until Task 4 (that's expected).

- [ ] **Step 5: Commit**

```bash
cd astro-site && git add astro.config.mjs package.json package-lock.json src/live.config.ts && git commit -m "feat: install EmDash integration"
```

---

## Task 2: Create EmDash collections via the admin UI

**Note:** EmDash stores schema in the database, not code. This task is done through the admin UI at `http://localhost:4321/_emdash/admin`. Run the dev server first.

Run the setup bypass to create an admin account:

```
GET http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
```

- [ ] **Step 1: Create `site` collection (single type)**

In the admin schema builder, create a new collection:
- Name: `site`, Kind: **Single**
- Add field: `backgroundColor` — type: **String**

- [ ] **Step 2: Create `page` collection (collection type)**

Create a new collection:
- Name: `page`, slug: `pages`, Kind: **Collection**
- Add field: `slug` — type: **String**, required
- Add field: `seo` — type: **JSON** (we'll store SEO as a JSON object: `{ metaTitle, metaDescription, shareImage }`)
- Add field: `blocks` — type: **Portable Text**

- [ ] **Step 3: Create `homepage` collection (single type)**

Create a new collection:
- Name: `homepage`, Kind: **Single**
- Add field: `seo` — type: **JSON**
- Add field: `blocks` — type: **Portable Text**

- [ ] **Step 4: Create `sidebar` collection (single type)**

Create a new collection:
- Name: `sidebar`, Kind: **Single**
- Add field: `topImage` — type: **JSON** (stores `{ url, alt }`)
- Add field: `categories` — type: **JSON** (stores the full categories array)
- Add field: `links` — type: **JSON** (stores the links array)

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: define EmDash collections via admin UI"
```

> **Note:** `npx emdash types` generates a typed `emdash-env.d.ts` when it becomes available. For now, Task 3 defines all types manually — skip the CLI step.

---

## Task 3: Define TypeScript types for block shapes

**Files:**
- Create: `astro-site/src/types/emdash.ts`

- [ ] **Step 1: Create the types file**

```typescript
// astro-site/src/types/emdash.ts

export interface MediaFile {
  url: string;
  alt: string | null;
}

export interface AdornmentBlock {
  file: MediaFile;
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
}

export interface MediaBlock {
  _type: "media";
  file: MediaFile;
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
  adornments?: AdornmentBlock[];
}

export interface RichTextBlock {
  _type: "richText";
  body: string;
}

export interface SpecialComponentBlock {
  _type: "specialComponent";
  type: "riso_colors";
}

export type Block = MediaBlock | RichTextBlock | SpecialComponentBlock;

export interface Seo {
  metaTitle?: string | null;
  metaDescription?: string | null;
  shareImage?: MediaFile | null;
}

export interface SidebarItem {
  text: string;
  page: { slug: string };
}

export interface SidebarCategory {
  categoryTitle: string;
  backgroundImage?: MediaFile | null;
  items: SidebarItem[];
}

export interface SidebarLink {
  service: string;
  url: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add astro-site/src/types/emdash.ts && git commit -m "feat: add EmDash TypeScript block and collection types"
```

---

## Task 4: Write fetch-emdash.ts and delete Strapi code

**Files:**
- Create: `astro-site/src/lib/fetch-emdash.ts`
- Delete: `astro-site/src/lib/fetch-strapi.ts`
- Delete: `astro-site/src/consts.ts`
- Delete: `astro-site/src/graphql/` (entire directory)
- Delete: `astro-site/codegen.ts`
- Modify: `astro-site/package.json`

- [ ] **Step 1: Create fetch-emdash.ts**

```typescript
// astro-site/src/lib/fetch-emdash.ts
import { getEmDashCollection, getEmDashEntry } from "emdash";
import type { Block, Seo, SidebarCategory, SidebarLink } from "../types/emdash";

export interface HomepageData {
  seo?: Seo | null;
  blocks?: Block[];
}

export interface PageData {
  slug: string;
  seo?: Seo | null;
  blocks?: Block[];
}

export interface SidebarData {
  topImage?: { url: string; alt: string | null } | null;
  categories?: SidebarCategory[];
  links?: SidebarLink[];
}

export interface SiteData {
  backgroundColor?: string | null;
}

export async function fetchHomepage(): Promise<HomepageData> {
  const { entry } = await getEmDashEntry("homepage", "homepage");
  if (!entry) throw new Error("Homepage not found");
  return entry.data as HomepageData;
}

export async function fetchPages(): Promise<PageData[]> {
  const { entries } = await getEmDashCollection("pages");
  return entries.map((e) => e.data as PageData);
}

export async function fetchPage(slug: string): Promise<PageData> {
  const { entry } = await getEmDashEntry("pages", slug);
  if (!entry) throw new Error(`Page not found: ${slug}`);
  return entry.data as PageData;
}

export async function fetchSite(): Promise<{ sidebar: SidebarData; site: SiteData }> {
  const [sidebarResult, siteResult] = await Promise.all([
    getEmDashEntry("sidebar", "sidebar"),
    getEmDashEntry("site", "site"),
  ]);
  const sidebar = (sidebarResult.entry?.data ?? {}) as SidebarData;
  const site = (siteResult.entry?.data ?? {}) as SiteData;
  return { sidebar, site };
}
```

- [ ] **Step 2: Delete Strapi-specific files**

```bash
rm astro-site/src/lib/fetch-strapi.ts
rm astro-site/src/consts.ts
rm astro-site/codegen.ts
rm -rf astro-site/src/graphql/
```

- [ ] **Step 3: Remove graphql-codegen devDependencies from package.json**

In `astro-site/package.json`, remove these from `devDependencies`:
- `@graphql-codegen/cli`
- `@graphql-codegen/schema-ast`

And remove the `"codegen"` script entry.

- [ ] **Step 4: Remove the codegen npm deps**

```bash
cd astro-site && npm uninstall @graphql-codegen/cli @graphql-codegen/schema-ast
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add fetch-emdash.ts, remove all Strapi/GraphQL code"
```

---

## Task 5: Update BlockRenderer, Sidebar, and Layout components

**Files:**
- Modify: `astro-site/src/components/BlockRenderer.astro`
- Modify: `astro-site/src/components/Sidebar.astro`
- Modify: `astro-site/src/layouts/Layout.astro`

- [ ] **Step 1: Rewrite BlockRenderer.astro**

Replace the entire file:

```astro
---
// astro-site/src/components/BlockRenderer.astro
import { marked } from "marked";
import RisoColors from "./RisoColors.astro";
import type { Block, MediaBlock } from "../types/emdash";

interface Props {
  blocks: Block[];
}

const { blocks } = Astro.props;

const generateFilterStyle = (block: MediaBlock) => ({
  filter: block.filter ?? undefined,
});

const generateStyle = (block: MediaBlock) => {
  const rotation = typeof block.rotation === "number" ? block.rotation : 0;
  const border = typeof block.border === "string" ? block.border : "none";
  const margin = typeof block.margin === "string" ? block.margin : "0 auto";
  return {
    left: block.left,
    top: block.top,
    bottom: block.bottom,
    right: block.right,
    filter: block.filter,
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    border,
    width: block.width,
    height: "auto",
    maxHeight: block.height,
    padding: block.padding,
    margin,
  };
};

const generateContainerStyle = (block: MediaBlock) => {
  const rotation = typeof block.rotation === "number" ? block.rotation : 0;
  const margin = typeof block.margin === "string" ? block.margin : "0 auto";
  return {
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    width: block.width,
    maxWidth: "100%",
    padding: block.padding,
    margin,
  };
};

const generateAdornmentStyle = (adornment: NonNullable<MediaBlock["adornments"]>[number]) => ({
  position: "absolute",
  left: adornment.left,
  top: adornment.top,
  bottom: adornment.bottom,
  right: adornment.right,
  filter: adornment.filter,
  transform:
    typeof adornment.rotation === "number" && adornment.rotation !== 0
      ? `rotate(${adornment.rotation}deg)`
      : undefined,
  border: adornment.border,
  width: adornment.width,
  maxHeight: adornment.height,
  padding: adornment.padding,
  margin: adornment.margin,
});
---

<article class="prose lg:prose-xl w-full flex flex-col gap-4">
  {
    blocks.map((block) =>
      block._type === "media" ? (
        Array.isArray(block.adornments) && block.adornments.length > 0 ? (
          <div
            style={generateContainerStyle(block)}
            class="image-with-adornments relative not-prose"
          >
            <img
              src={block.file.url}
              alt={block.file.alt ?? ""}
              style={{
                ...generateFilterStyle(block),
                maxHeight: block.height,
                border: block.border,
              }}
            />
            {block.adornments.map((adornment) => (
              <img
                src={adornment.file.url}
                alt={adornment.file.alt ?? ""}
                style={generateAdornmentStyle(adornment)}
              />
            ))}
          </div>
        ) : (
          <img
            src={block.file.url}
            alt={block.file.alt ?? ""}
            style={{
              ...generateStyle(block),
              ...generateFilterStyle(block),
            }}
          />
        )
      ) : block._type === "richText" ? (
        <Fragment set:html={marked.parse(block.body)} />
      ) : block._type === "specialComponent" && block.type === "riso_colors" ? (
        <RisoColors />
      ) : null
    )
  }
</article>

<style>
  img {
    max-width: 100%;
    height: auto;
  }

  .image-with-adornments {
    display: block;
    max-width: 100%;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .image-with-adornments > img:first-child {
    display: block;
    max-width: 100%;
    height: auto;
    object-fit: contain;
  }

  .image-with-adornments > img:not(:first-child) {
    pointer-events: none;
    max-width: none;
  }
</style>
```

- [ ] **Step 2: Update Sidebar.astro**

Replace the entire frontmatter import section and image src attributes — remove all `externalStrapiUrl` usage and update the Props type:

```astro
---
// astro-site/src/components/Sidebar.astro
import type { SidebarData } from "../lib/fetch-emdash";

interface Props {
  sidebar: SidebarData;
}

const sidebar = Astro.props.sidebar;
---

<nav class="flex flex-col gap-4 w-full lg:w-48 shrink-0">
  <a href="/" class="pb-2">
    <img
      src={sidebar.topImage?.url}
      alt={sidebar.topImage?.alt ?? ""}
      class="w-40 h-40 mx-auto border-black border-b-2"
    />
  </a>
  <details class="group max-lg:w-full lg:block" open>
    <summary
      class="max-lg:list-none max-lg:select-none max-lg:block lg:hidden cursor-pointer text-lg font-bold mb-4 px-4 py-2 bg-link text-white hover:bg-link/90 transition-colors duration-150 [&::-webkit-details-marker]:hidden marker:hidden"
    >
      <span class="flex items-center justify-between">
        <span>Menu</span>
        <span
          class="inline-block transition-transform duration-300 ease-in-out group-open:rotate-180"
          aria-hidden="true">▼</span
        >
      </span>
    </summary>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3">
        {
          sidebar.categories?.map((category) => (
            <div class="flex flex-col gap-1.5">
              <p
                class="text-lg font-bold min-h-8 mt-2 mb-1 brightness-[1.4] bg-contain bg-no-repeat text-black"
                style={
                  category.backgroundImage?.url
                    ? `background-image: url('${category.backgroundImage.url}')`
                    : undefined
                }
              >
                {category.categoryTitle}
              </p>
              <ul class="flex flex-col gap-2">
                {category.items.map((item) => (
                  <li class="list-none">
                    <a
                      href={`/${item.page.slug}`}
                      class="hover:text-link hover:underline"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))
        }
      </div>
      <a
        href="/contact"
        class="bg-link text-white font-semibold px-4 py-2 text-center hover:bg-link/90 transition-colors duration-150 mx-auto w-full italic my-4 tracking-[0.02em]"
      >
        Contact Me
      </a>
      <div class="flex flex-col gap-2">
        {
          sidebar.links?.map((link) => (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-link hover:underline"
            >
              {link.service}
            </a>
          ))
        }
      </div>
    </div>
  </details>
</nav>

<script>
  const details = document.querySelector("details");
  function isSmallScreen() {
    return window.matchMedia("(max-width: 1024px)").matches;
  }

  if (isSmallScreen() && details) {
    details.open = false;
  }

  let lastIsLarge = window.matchMedia("(min-width: 1025px)").matches;

  window.addEventListener("resize", () => {
    if (!details) return;
    const isLarge = window.matchMedia("(min-width: 1025px)").matches;
    if (isLarge) {
      details.open = true;
    } else if (lastIsLarge && !isLarge) {
      details.open = false;
    }
    lastIsLarge = isLarge;
  });
</script>
```

- [ ] **Step 3: Update Layout.astro**

Replace the entire file:

```astro
---
// astro-site/src/layouts/Layout.astro
import { ClientRouter } from "astro:transitions";
import Sidebar from "../components/Sidebar.astro";
import "../styles/global.css";
import { fetchSite } from "../lib/fetch-emdash";

interface Props {
  title?: string;
  description?: string | null;
  seoImageUrl?: string | null;
}

const { site, sidebar } = await fetchSite();
const { title, description, seoImageUrl } = Astro.props;
---

<html lang="en" transition:name="root" transition:animate="none">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="viewport" content="width=device-width" />
    {description && <meta name="description" content={description} />}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Gluten:wght@100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css"
    />
    <title>
      {title ? `${title} | Andrew Gosse Composer` : "Andrew Gosse Composer"}
    </title>
    {
      seoImageUrl && (
        <>
          <meta property="og:image" content={seoImageUrl} />
          <meta name="twitter:image" content={seoImageUrl} />
          <meta name="twitter:card" content="summary_large_image" />
        </>
      )
    }
    {
      title && (
        <>
          <meta property="og:title" content={title} />
          <meta name="twitter:title" content={title} />
        </>
      )
    }
    {
      description && (
        <>
          <meta property="og:description" content={description} />
          <meta name="twitter:description" content={description} />
        </>
      )
    }
    <meta property="og:type" content="website" />
  </head>
  <body
    class="flex flex-col justify-center items-center lg:items-start lg:justify-start lg:flex-row p-8 gap-8 max-w-[100ch] mx-auto"
  >
    <Sidebar sidebar={sidebar} />
    <div transition:animate="none" class="flex-1">
      <slot />
    </div>
  </body>
</html>

<style define:vars={{ backgroundColor: site.backgroundColor ?? "#ffffff" }}>
  body {
    background-color: var(--backgroundColor);
  }
</style>

<ClientRouter />
```

- [ ] **Step 4: Update index.astro**

```astro
---
// astro-site/src/pages/index.astro
import BlockRenderer from "../components/BlockRenderer.astro";
import Layout from "../layouts/Layout.astro";
import { fetchHomepage } from "../lib/fetch-emdash";
import type { Block } from "../types/emdash";

const homepage = await fetchHomepage();
---

<Layout
  title={homepage.seo?.metaTitle}
  description={homepage.seo?.metaDescription}
  seoImageUrl={homepage.seo?.shareImage?.url}
>
  <BlockRenderer blocks={(homepage.blocks ?? []) as Block[]} />
</Layout>
```

- [ ] **Step 5: Update [...slug].astro**

```astro
---
// astro-site/src/pages/[...slug].astro
import Layout from "../layouts/Layout.astro";
import BlockRenderer from "../components/BlockRenderer.astro";
import { fetchPage } from "../lib/fetch-emdash";
import type { Block } from "../types/emdash";

const { slug } = Astro.params;

if (!slug) {
  throw new Error("Slug is required");
}

const page = await fetchPage(slug);
---

<Layout
  title={page.seo?.metaTitle}
  description={page.seo?.metaDescription}
  seoImageUrl={page.seo?.shareImage?.url}
>
  <BlockRenderer blocks={(page.blocks ?? []) as Block[]} />
</Layout>
```

- [ ] **Step 6: Verify the dev server still starts without TypeScript errors**

```bash
cd astro-site && npm run dev
```

The pages will render empty/broken (no data yet — that's expected until Task 7). No TypeScript or import errors should appear.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: update all components and pages to use EmDash data layer"
```

---

## Task 6: Update infrastructure files

**Files:**
- Modify: `compose.yml`
- Modify: `astro-site/.env.dist` (or `.env` if no `.env.dist` exists)

- [ ] **Step 1: Replace compose.yml**

```yaml
# compose.yml
services:
  site:
    build: ./astro-site
    ports:
      - "127.0.0.1:4322:4321"
    environment:
      - EMDASH_SECRET=${EMDASH_SECRET}
    volumes:
      - ./emdash_data:/app/data

networks: {}
```

- [ ] **Step 2: Update .env / .env.dist**

In `astro-site/.env`, remove `STRAPI_URL` and `EXTERNAL_STRAPI_URL`. Add:

```bash
EMDASH_SECRET=dev-secret-change-in-production
```

Also update `astro-site/.env.dist` if it exists to match.

- [ ] **Step 3: Create emdash_data directory with .gitkeep**

```bash
mkdir -p emdash_data && touch emdash_data/.gitkeep
```

Add `emdash_data/*.db` and `emdash_data/uploads/` to `.gitignore` (the directory itself should be committed, not its contents):

```bash
echo "emdash_data/*.db" >> .gitignore
echo "emdash_data/uploads/" >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: update compose.yml and env for EmDash, remove Strapi service"
```

---

## Task 7: Write the migration script

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/migrate-from-strapi.ts`

- [ ] **Step 1: Create scripts/package.json**

```json
{
  "name": "andrew-gosse-site-scripts",
  "type": "module",
  "private": true,
  "scripts": {
    "migrate": "tsx migrate-from-strapi.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "tsx": "^4.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

- [ ] **Step 2: Install script deps**

```bash
cd scripts && npm install
```

- [ ] **Step 3: Create scripts/migrate-from-strapi.ts**

```typescript
// scripts/migrate-from-strapi.ts
/**
 * One-time migration script: Strapi SQLite → EmDash
 *
 * Reads from:
 *   ../tmp/backups/andrewsite_strapi_data/data.db
 *   ../tmp/backups/andrewsite_strapi_uploads/
 *
 * Writes to EmDash running at http://localhost:4321
 *
 * Run with: npm run migrate (from scripts/ directory)
 * EmDash dev server must be running: cd astro-site && npm run dev
 */

import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DB_PATH = path.join(ROOT, "tmp/backups/andrewsite_strapi_data/data.db");
const UPLOADS_PATH = path.join(ROOT, "tmp/backups/andrewsite_strapi_uploads");
const EMDASH_URL = "http://localhost:4321";
const EMDASH_API = `${EMDASH_URL}/_emdash/api`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StrapiFile {
  id: number;
  name: string;
  url: string; // e.g. /uploads/foo_abc123.jpg
  alternativeText?: string | null;
}

interface StrapiMediaComponent {
  id: number;
  width?: string | null;
  height?: string | null;
  border?: string | null;
  rotation?: number | null;
  top?: string | null;
  bottom?: string | null;
  left?: string | null;
  right?: string | null;
  filter?: string | null;
  padding?: string | null;
  margin?: string | null;
}

interface CmpRow {
  entity_id: number;
  cmp_id: number;
  component_type: string;
  field: string;
  order: number;
}

// ─── Database setup ───────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Get a session cookie by hitting the dev bypass endpoint.
 * EmDash must be running in dev mode (npm run dev).
 */
async function getSessionCookie(): Promise<string> {
  const res = await fetch(`${EMDASH_API}/auth/dev-bypass`, { method: "POST" });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error(
      "No session cookie returned from dev bypass. Is EmDash running in dev mode?"
    );
  }
  // Extract just the cookie name=value part (before first semicolon)
  return setCookie.split(";")[0];
}

// ─── Media upload ─────────────────────────────────────────────────────────────

const RESIZED_PREFIXES = ["large_", "medium_", "small_", "thumbnail_"];

function isResizedVariant(filename: string): boolean {
  return RESIZED_PREFIXES.some((p) => filename.startsWith(p));
}

/**
 * Upload all original (non-resized) files from the Strapi uploads backup.
 * Returns a map of strapiPath → emdashUrl.
 * e.g. "/uploads/foo_abc123.jpg" → "/_emdash/api/media/file/abc123def456..."
 */
async function uploadAllMedia(cookie: string): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  const files = fs.readdirSync(UPLOADS_PATH).filter((f) => !isResizedVariant(f));
  console.log(`Uploading ${files.length} original media files...`);

  for (const filename of files) {
    const filePath = path.join(UPLOADS_PATH, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const strapiPath = `/uploads/${filename}`;

    // Check if already uploaded by looking up in the Strapi files table
    const strapiFile = db
      .prepare<[], StrapiFile>("SELECT * FROM files WHERE url = ?")
      .get(strapiPath);

    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(filePath)]);
    formData.append("file", blob, filename);
    if (strapiFile?.alternativeText) {
      formData.append("altText", strapiFile.alternativeText);
    }

    const res = await fetch(`${EMDASH_API}/media`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-EmDash-Request": "1",
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`  ⚠ Failed to upload ${filename}: ${res.status} ${text}`);
      continue;
    }

    const data = (await res.json()) as { url?: string };
    if (data.url) {
      urlMap.set(strapiPath, `${EMDASH_URL}${data.url}`);
      console.log(`  ✓ ${filename} → ${data.url}`);
    }
  }

  return urlMap;
}

// ─── Block reconstruction ─────────────────────────────────────────────────────

function getFileForMedia(mediaId: number): StrapiFile | undefined {
  return db
    .prepare<[number], StrapiFile>(
      `SELECT f.id, f.name, f.url, f.alternative_text as alternativeText
       FROM files f
       JOIN files_related_mph frm ON f.id = frm.file_id
       WHERE frm.related_id = ? AND frm.related_type = 'shared.media' AND frm.field = 'file'
       LIMIT 1`
    )
    .get(mediaId);
}

function getAdornmentsForMedia(
  mediaId: number,
  urlMap: Map<string, string>
): object[] {
  const links = db
    .prepare<[number], { adornment_id: number }>(
      `SELECT adornment_id FROM components_shared_media_adornments_lnk
       WHERE media_id = ? ORDER BY adornment_ord`
    )
    .all(mediaId);

  return links.flatMap(({ adornment_id }) => {
    // Get the adornment's media component
    const adornmentCmp = db
      .prepare<
        [number],
        StrapiMediaComponent & { published_at: string | null }
      >(
        `SELECT csm.* FROM adornments a
         JOIN adornments_cmps ac ON ac.entity_id = a.id AND ac.component_type = 'shared.media'
         JOIN components_shared_media csm ON csm.id = ac.cmp_id
         WHERE a.id = ? AND a.published_at IS NOT NULL
         LIMIT 1`
      )
      .get(adornment_id);

    if (!adornmentCmp) return [];

    const file = getFileForMedia(adornmentCmp.id);
    if (!file) return [];

    const emdashUrl = urlMap.get(file.url) ?? file.url;
    return [
      {
        file: { url: emdashUrl, alt: file.alternativeText ?? null },
        width: adornmentCmp.width ?? undefined,
        height: adornmentCmp.height ?? undefined,
        padding: adornmentCmp.padding ?? undefined,
        margin: adornmentCmp.margin ?? undefined,
        top: adornmentCmp.top ?? undefined,
        right: adornmentCmp.right ?? undefined,
        bottom: adornmentCmp.bottom ?? undefined,
        left: adornmentCmp.left ?? undefined,
        rotation: adornmentCmp.rotation ?? undefined,
        border: adornmentCmp.border ?? undefined,
        filter: adornmentCmp.filter ?? undefined,
      },
    ];
  });
}

function buildBlocks(
  cmps: CmpRow[],
  urlMap: Map<string, string>
): object[] {
  const blockCmps = cmps.filter((c) => c.field === "blocks").sort((a, b) => a.order - b.order);

  return blockCmps.flatMap((cmp) => {
    if (cmp.component_type === "shared.rich-text") {
      const row = db
        .prepare<[number], { body: string }>(
          "SELECT body FROM components_shared_rich_texts WHERE id = ?"
        )
        .get(cmp.cmp_id);
      if (!row) return [];
      return [{ _type: "richText", body: row.body }];
    }

    if (cmp.component_type === "shared.media") {
      const media = db
        .prepare<[number], StrapiMediaComponent>(
          "SELECT * FROM components_shared_media WHERE id = ?"
        )
        .get(cmp.cmp_id);
      if (!media) return [];

      const file = getFileForMedia(media.id);
      if (!file) return [];

      const emdashUrl = urlMap.get(file.url) ?? file.url;
      const adornments = getAdornmentsForMedia(media.id, urlMap);

      return [
        {
          _type: "media",
          file: { url: emdashUrl, alt: file.alternativeText ?? null },
          width: media.width ?? undefined,
          height: media.height ?? undefined,
          padding: media.padding ?? undefined,
          margin: media.margin ?? undefined,
          top: media.top ?? undefined,
          right: media.right ?? undefined,
          bottom: media.bottom ?? undefined,
          left: media.left ?? undefined,
          rotation: media.rotation ?? undefined,
          border: media.border ?? undefined,
          filter: media.filter ?? undefined,
          ...(adornments.length > 0 ? { adornments } : {}),
        },
      ];
    }

    if (cmp.component_type === "shared.special-component") {
      const row = db
        .prepare<[number], { type: string }>(
          "SELECT type FROM components_shared_special_components WHERE id = ?"
        )
        .get(cmp.cmp_id);
      if (!row) return [];
      // Strapi stores "riso-colors", spec uses "riso_colors"
      return [{ _type: "specialComponent", type: row.type.replace("-", "_") }];
    }

    return [];
  });
}

function buildSeo(cmps: CmpRow[], urlMap: Map<string, string>): object | null {
  const seoCmp = cmps.find((c) => c.field === "seo" && c.component_type === "shared.seo");
  if (!seoCmp) return null;

  const seo = db
    .prepare<[number], { meta_title?: string; meta_description?: string }>(
      "SELECT meta_title, meta_description FROM components_shared_seos WHERE id = ?"
    )
    .get(seoCmp.cmp_id);
  if (!seo) return null;

  const shareFile = db
    .prepare<[number], StrapiFile>(
      `SELECT f.id, f.name, f.url, f.alternative_text as alternativeText
       FROM files f
       JOIN files_related_mph frm ON f.id = frm.file_id
       WHERE frm.related_id = ? AND frm.related_type = 'shared.seos' AND frm.field = 'shareImage'
       LIMIT 1`
    )
    .get(seoCmp.cmp_id);

  return {
    metaTitle: seo.meta_title ?? null,
    metaDescription: seo.meta_description ?? null,
    shareImage: shareFile
      ? {
          url: urlMap.get(shareFile.url) ?? shareFile.url,
          alt: shareFile.alternativeText ?? null,
        }
      : null,
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function contentExists(collection: string, slug: string, cookie: string): Promise<boolean> {
  const res = await fetch(`${EMDASH_API}/content/${collection}?status=published`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { items?: Array<{ slug: string }> };
  return (data.items ?? []).some((item) => item.slug === slug);
}

async function createContent(
  collection: string,
  payload: { slug?: string; data: object; seo?: object | null; status: string },
  cookie: string
): Promise<void> {
  const res = await fetch(`${EMDASH_API}/content/${collection}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-EmDash-Request": "1",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create ${collection}/${payload.slug ?? "(single)"}: ${res.status} ${text}`);
  }
}

async function publishContent(
  collection: string,
  slug: string,
  cookie: string
): Promise<void> {
  // Get the item ID first
  const res = await fetch(`${EMDASH_API}/content/${collection}/${slug}`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) return;
  const data = (await res.json()) as { id?: string };
  if (!data.id) return;

  await fetch(`${EMDASH_API}/content/${collection}/${data.id}/publish`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "X-EmDash-Request": "1",
    },
  });
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedSite(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding site ---");

  const exists = await contentExists("site", "site", cookie);
  if (exists) {
    console.log("  site already exists, skipping");
    return;
  }

  const site = db
    .prepare<[], { background_color: string }>(
      "SELECT background_color FROM sites WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();

  if (!site) {
    console.log("  No published site found");
    return;
  }

  await createContent(
    "site",
    { slug: "site", data: { backgroundColor: site.background_color }, status: "published" },
    cookie
  );
  await publishContent("site", "site", cookie);
  console.log("  ✓ site seeded");
}

async function seedPages(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding pages ---");

  // Get all published pages, deduplicated by slug (highest id wins)
  const pages = db
    .prepare<
      [],
      { id: number; slug: string; published_at: string }
    >(
      `SELECT id, slug, published_at
       FROM pages
       WHERE published_at IS NOT NULL
       GROUP BY slug
       HAVING id = MAX(id)
       ORDER BY id`
    )
    .all();

  console.log(`  Found ${pages.length} published pages`);

  for (const page of pages) {
    const exists = await contentExists("pages", page.slug, cookie);
    if (exists) {
      console.log(`  page/${page.slug} already exists, skipping`);
      continue;
    }

    const cmps = db
      .prepare<[number], CmpRow>(
        `SELECT entity_id, cmp_id, component_type, field, [order]
         FROM pages_cmps WHERE entity_id = ? ORDER BY [order]`
      )
      .all(page.id);

    const blocks = buildBlocks(cmps, urlMap);
    const seo = buildSeo(cmps, urlMap);

    await createContent(
      "pages",
      { slug: page.slug, data: { slug: page.slug, blocks }, seo, status: "published" },
      cookie
    );
    await publishContent("pages", page.slug, cookie);
    console.log(`  ✓ page/${page.slug}`);
  }
}

async function seedSidebar(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding sidebar ---");

  const exists = await contentExists("sidebar", "sidebar", cookie);
  if (exists) {
    console.log("  sidebar already exists, skipping");
    return;
  }

  const sidebar = db
    .prepare<[], { id: number }>(
      "SELECT id FROM sidebars WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();

  if (!sidebar) {
    console.log("  No published sidebar found");
    return;
  }

  // Top image
  const topImageFile = db
    .prepare<[number], StrapiFile>(
      `SELECT f.id, f.url, f.alternative_text as alternativeText
       FROM files f
       JOIN files_related_mph frm ON f.id = frm.file_id
       WHERE frm.related_id = ? AND frm.related_type = 'api::sidebar.sidebar' AND frm.field = 'topImage'
       LIMIT 1`
    )
    .get(sidebar.id);

  const topImage = topImageFile
    ? {
        url: urlMap.get(topImageFile.url) ?? topImageFile.url,
        alt: topImageFile.alternativeText ?? null,
      }
    : null;

  // Categories
  const categoryCmps = db
    .prepare<[number], { cmp_id: number; order: number }>(
      `SELECT cmp_id, [order] FROM sidebars_cmps
       WHERE entity_id = ? AND component_type = 'shared.sidebar-category'
       ORDER BY [order]`
    )
    .all(sidebar.id);

  const categories = categoryCmps.map(({ cmp_id }) => {
    const cat = db
      .prepare<[number], { id: number; category_title: string }>(
        "SELECT id, category_title FROM components_shared_sidebar_categories WHERE id = ?"
      )
      .get(cmp_id);

    if (!cat) return null;

    // Background image
    const bgFile = db
      .prepare<[number], StrapiFile>(
        `SELECT f.url, f.alternative_text as alternativeText
         FROM files f
         JOIN files_related_mph frm ON f.id = frm.file_id
         WHERE frm.related_id = ? AND frm.related_type = 'shared.sidebar-category'
         AND frm.field = 'backgroundImage' LIMIT 1`
      )
      .get(cat.id);

    // Items
    const itemCmps = db
      .prepare<[number], { cmp_id: number; order: number }>(
        `SELECT cmp_id, [order]
         FROM components_shared_sidebar_categories_cmps
         WHERE entity_id = ? AND component_type = 'shared.sidebar-item'
         ORDER BY [order]`
      )
      .all(cat.id);

    const items = itemCmps.flatMap(({ cmp_id: itemCmpId }) => {
      const item = db
        .prepare<[number], { id: number; text: string }>(
          "SELECT id, text FROM components_shared_sidebar_items WHERE id = ?"
        )
        .get(itemCmpId);
      if (!item) return [];

      const pageLink = db
        .prepare<[number], { slug: string }>(
          `SELECT p.slug FROM pages p
           JOIN components_shared_sidebar_items_page_lnk lnk ON lnk.page_id = p.id
           WHERE lnk.sidebar_item_id = ?
           AND p.published_at IS NOT NULL
           ORDER BY p.id DESC LIMIT 1`
        )
        .get(item.id);
      if (!pageLink) return [];

      return [{ text: item.text, page: { slug: pageLink.slug } }];
    });

    return {
      categoryTitle: cat.category_title,
      backgroundImage: bgFile
        ? {
            url: urlMap.get(bgFile.url) ?? bgFile.url,
            alt: bgFile.alternativeText ?? null,
          }
        : null,
      items,
    };
  }).filter(Boolean);

  // Links
  const linkCmps = db
    .prepare<[number], { cmp_id: number }>(
      `SELECT cmp_id FROM sidebars_cmps
       WHERE entity_id = ? AND component_type = 'shared.sidebar-link'
       ORDER BY [order]`
    )
    .all(sidebar.id);

  const links = linkCmps.flatMap(({ cmp_id }) => {
    const link = db
      .prepare<[number], { service: string; url: string }>(
        "SELECT service, url FROM components_shared_sidebar_links WHERE id = ?"
      )
      .get(cmp_id);
    return link ? [link] : [];
  });

  await createContent(
    "sidebar",
    {
      slug: "sidebar",
      data: { topImage, categories, links },
      status: "published",
    },
    cookie
  );
  await publishContent("sidebar", "sidebar", cookie);
  console.log("  ✓ sidebar seeded");
}

async function seedHomepage(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding homepage ---");

  const exists = await contentExists("homepage", "homepage", cookie);
  if (exists) {
    console.log("  homepage already exists, skipping");
    return;
  }

  const homepage = db
    .prepare<[], { id: number }>(
      "SELECT id FROM homepages WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();

  if (!homepage) {
    console.log("  No published homepage found");
    return;
  }

  const cmps = db
    .prepare<[number], CmpRow>(
      `SELECT entity_id, cmp_id, component_type, field, [order]
       FROM homepages_cmps WHERE entity_id = ? ORDER BY [order]`
    )
    .all(homepage.id);

  const blocks = buildBlocks(cmps, urlMap);
  const seo = buildSeo(cmps, urlMap);

  await createContent(
    "homepage",
    { slug: "homepage", data: { blocks }, seo, status: "published" },
    cookie
  );
  await publishContent("homepage", "homepage", cookie);
  console.log("  ✓ homepage seeded");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Strapi → EmDash migration\n");
  console.log(`DB: ${DB_PATH}`);
  console.log(`Uploads: ${UPLOADS_PATH}`);
  console.log(`EmDash: ${EMDASH_URL}\n`);

  // Verify files exist
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Strapi DB not found at ${DB_PATH}`);
  }
  if (!fs.existsSync(UPLOADS_PATH)) {
    throw new Error(`Uploads not found at ${UPLOADS_PATH}`);
  }

  const cookie = await getSessionCookie();
  console.log("✓ Authenticated with EmDash\n");

  const urlMap = await uploadAllMedia(cookie);
  console.log(`\n✓ Uploaded ${urlMap.size} media files`);

  await seedSite(urlMap, cookie);
  await seedPages(urlMap, cookie);
  await seedSidebar(urlMap, cookie);
  await seedHomepage(urlMap, cookie);

  console.log("\n✓ Migration complete!");
  db.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ && git commit -m "feat: add Strapi → EmDash migration script"
```

---

## Task 8: Run the migration

**Prerequisites:** EmDash dev server is running (`cd astro-site && npm run dev`).

- [ ] **Step 1: Start the dev server (separate terminal)**

```bash
cd astro-site && npm run dev
```

Wait until you see `Local: http://localhost:4321/`

- [ ] **Step 2: Run the setup bypass to initialise EmDash DB and create admin user**

```bash
curl -s "http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin" -o /dev/null -w "%{http_code}\n"
```

Expected: `200` or `302`.

- [ ] **Step 3: Create collections in admin UI (if not done in Task 2)**

Navigate to `http://localhost:4321/_emdash/admin` and create the four collections (`site`, `pages`, `homepage`, `sidebar`) as described in Task 2 if you haven't already.

- [ ] **Step 4: Run the migration script**

```bash
cd scripts && npm run migrate
```

Expected output ends with `✓ Migration complete!`. Watch for any `⚠` warnings about failed uploads.

- [ ] **Step 5: Verify the site renders**

Open `http://localhost:4321/` — the homepage should render with the correct background color, sidebar, and content blocks. Open a few pages like `http://localhost:4321/game-audio` and `http://localhost:4321/paintings`.

- [ ] **Step 6: Verify the admin shows content**

Open `http://localhost:4321/_emdash/admin` and browse the collections — pages, homepage, sidebar, and site should all have data.

- [ ] **Step 7: Commit data directory placeholder**

```bash
git add emdash_data/.gitkeep && git commit -m "chore: add emdash_data directory placeholder"
```

---

## Task 9: Delete the Strapi app

- [ ] **Step 1: Remove the strapi directory**

```bash
rm -rf strapi/
```

- [ ] **Step 2: Update root .gitignore**

In `.gitignore`, remove the `strapi_data/` line (the directory is gone).

- [ ] **Step 3: Verify the site still runs**

```bash
cd astro-site && npm run dev
```

Open `http://localhost:4321/` — site should still render correctly. The absence of `strapi/` should have no effect.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove Strapi app directory"
```

---

## Task 10: Build and smoke test Docker

- [ ] **Step 1: Build the Docker image**

```bash
docker compose build
```

Expected: builds cleanly, no errors.

- [ ] **Step 2: Start the container**

```bash
docker compose up -d
```

- [ ] **Step 3: Check the site loads**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4322/
```

Expected: `200`.

- [ ] **Step 4: Copy the EmDash data into the volume**

The container starts fresh (no data). Copy the local dev DB into the volume directory:

```bash
mkdir -p emdash_data/uploads
cp astro-site/data/emdash.db emdash_data/emdash.db
cp -r astro-site/data/uploads/ emdash_data/uploads/
```

Restart the container:

```bash
docker compose restart site
```

- [ ] **Step 5: Verify content loads in Docker**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4322/game-audio
```

Expected: `200`.

- [ ] **Step 6: Commit final state**

```bash
git add -A && git commit -m "chore: final cleanup and Docker smoke test"
```

---

## Self-Review Checklist (for the implementer)

After completing all tasks, verify:

- [ ] `http://localhost:4321/` renders the homepage with correct background color and sidebar
- [ ] `http://localhost:4321/paintings` renders with images, adornments, and correct styles
- [ ] `http://localhost:4321/game-audio` renders rich text with correct markdown
- [ ] Sidebar nav links all work
- [ ] `/_emdash/admin` is accessible
- [ ] No TypeScript errors: `cd astro-site && npm run build` completes without errors
- [ ] No references to `externalStrapiUrl`, `strapiUrl`, `fetch-strapi`, or `graphql/` remain in `astro-site/src/`
- [ ] `docker compose up` starts a single service (no `strapi` service)
