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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StrapiFile {
  id: number;
  name: string;
  url: string;
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

async function getSessionCookie(): Promise<string> {
  const res = await fetch(`${EMDASH_API}/auth/dev-bypass`, {
    method: "POST",
    headers: {
      Origin: EMDASH_URL,
      "Content-Type": "application/json",
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `No session cookie returned from dev bypass (${res.status}). Is EmDash running in dev mode? Body: ${text}`
    );
  }
  return setCookie.split(";")[0];
}

// ─── Media upload ─────────────────────────────────────────────────────────────

const RESIZED_PREFIXES = ["large_", "medium_", "small_", "thumbnail_"];

function isResizedVariant(filename: string): boolean {
  return RESIZED_PREFIXES.some((p) => filename.startsWith(p));
}

/** Map file extension to MIME type for upload validation */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".pdf": "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

async function uploadAllMedia(cookie: string): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  const files = fs.readdirSync(UPLOADS_PATH).filter((f) => !isResizedVariant(f));
  console.log(`Uploading ${files.length} original media files...`);

  for (const filename of files) {
    const filePath = path.join(UPLOADS_PATH, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const strapiPath = `/uploads/${filename}`;

    const strapiFile = db
      .prepare<[string], StrapiFile>(
        "SELECT id, name, url, alternative_text as alternativeText FROM files WHERE url = ?"
      )
      .get(strapiPath);

    const mimeType = getMimeType(filename);
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(filePath)], { type: mimeType });
    formData.append("file", blob, filename);
    if (strapiFile?.alternativeText) {
      formData.append("altText", strapiFile.alternativeText);
    }

    const res = await fetch(`${EMDASH_API}/media`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-EmDash-Request": "1",
        Origin: EMDASH_URL,
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`  ⚠ Failed to upload ${filename}: ${res.status} ${text}`);
      continue;
    }

    // API returns { data: { item: { url: "..." } } } or { data: { item: {...}, deduplicated: true } }
    const json = (await res.json()) as { data?: { item?: { url?: string }; deduplicated?: boolean } };
    const itemUrl = json.data?.item?.url;
    if (itemUrl) {
      const fullUrl = itemUrl.startsWith("http") ? itemUrl : `${EMDASH_URL}${itemUrl}`;
      urlMap.set(strapiPath, fullUrl);
      const dedup = json.data?.deduplicated ? " (dedup)" : "";
      console.log(`  ✓ ${filename} → ${itemUrl}${dedup}`);
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
    .get(mediaId) ?? undefined;
}

function getAdornmentsForMedia(mediaId: number, _urlMap: Map<string, string>): object[] {
  const links = db
    .prepare<[number], { adornment_id: number }>(
      `SELECT adornment_id FROM components_shared_media_adornments_lnk
       WHERE media_id = ? ORDER BY adornment_ord`
    )
    .all(mediaId);

  return links.flatMap(({ adornment_id }) => {
    const adornment = db
      .prepare<[number], { name: string }>(
        "SELECT name FROM adornments WHERE id = ? AND published_at IS NOT NULL LIMIT 1"
      )
      .get(adornment_id);

    if (!adornment) return [];
    return [{ _adornmentName: adornment.name }];
  });
}

function buildBlocks(cmps: CmpRow[], urlMap: Map<string, string>): object[] {
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
      // Strapi stores "riso-colors", we use "riso_colors"
      return [{ _type: "specialComponent", type: row.type.replace(/-/g, "_") }];
    }

    return [];
  });
}

function buildSeo(cmps: CmpRow[], urlMap: Map<string, string>): object | null {
  const seoCmp = cmps.find((c) => c.field === "seo" && c.component_type === "shared.seo");
  if (!seoCmp) return null;

  const seo = db
    .prepare<[number], { meta_title?: string | null; meta_description?: string | null }>(
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
    headers: { Cookie: cookie, Origin: EMDASH_URL },
  });
  if (!res.ok) return false;
  // API returns { data: { items: [...] } }
  const json = (await res.json()) as { data?: { items?: Array<{ slug: string }> } };
  return (json.data?.items ?? []).some((item) => item.slug === slug);
}

async function createContent(
  collection: string,
  payload: { slug?: string; data: object; seo?: object | null; status: string },
  cookie: string
): Promise<void> {
  // Strip null seo — EmDash rejects null, expects object or omitted
  const body: Record<string, unknown> = { ...payload };
  if (body.seo == null) delete body.seo;

  const res = await fetch(`${EMDASH_API}/content/${collection}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-EmDash-Request": "1",
      Origin: EMDASH_URL,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to create ${collection}/${payload.slug ?? "(single)"}: ${res.status} ${text}`
    );
  }
}

async function updateContent(
  collection: string,
  slug: string,
  payload: { data: object; seo?: object | null },
  cookie: string
): Promise<void> {
  // Look up ID by slug first (must be published/listed)
  const res = await fetch(`${EMDASH_API}/content/${collection}?status=published`, {
    headers: { Cookie: cookie, Origin: EMDASH_URL },
  });
  if (!res.ok) return;
  const json = (await res.json()) as { data?: { items?: Array<{ id: string; slug: string }> } };
  const item = (json.data?.items ?? []).find((i) => i.slug === slug);
  if (!item) return;

  const body: Record<string, unknown> = { ...payload };
  if (body.seo == null) delete body.seo;

  await fetch(`${EMDASH_API}/content/${collection}/${item.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-EmDash-Request": "1",
      Origin: EMDASH_URL,
    },
    body: JSON.stringify(body),
  });
}

/**
 * For singleton collections: restore from trash if needed, then update.
 * Used by --reset mode when the singleton was previously soft-deleted.
 */
async function restoreOrUpdateSingleton(
  collection: string,
  slug: string,
  payload: { data: object; seo?: object | null },
  cookie: string
): Promise<"restored" | "updated" | "not_found"> {
  // First check if it's in trash
  const trashRes = await fetch(`${EMDASH_API}/content/${collection}/trash?limit=100`, {
    headers: { Cookie: cookie, Origin: EMDASH_URL },
  });
  if (trashRes.ok) {
    const trashJson = (await trashRes.json()) as {
      data?: { items?: Array<{ id: string; slug: string }> };
    };
    const trashed = (trashJson.data?.items ?? []).find((i) => i.slug === slug);
    if (trashed) {
      // Restore it
      await fetch(`${EMDASH_API}/content/${collection}/${trashed.id}/restore`, {
        method: "POST",
        headers: { Cookie: cookie, "X-EmDash-Request": "1", Origin: EMDASH_URL },
      });
      // Now update with new data
      const body: Record<string, unknown> = { ...payload };
      if (body.seo == null) delete body.seo;
      await fetch(`${EMDASH_API}/content/${collection}/${trashed.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-EmDash-Request": "1",
          Origin: EMDASH_URL,
        },
        body: JSON.stringify(body),
      });
      return "restored";
    }
  }

  // Check if it's already published
  const exists = await contentExists(collection, slug, cookie);
  if (exists) {
    await updateContent(collection, slug, payload, cookie);
    return "updated";
  }

  return "not_found";
}

async function publishContent(
  collection: string,
  slug: string,
  cookie: string
): Promise<void> {
  const res = await fetch(`${EMDASH_API}/content/${collection}/${slug}`, {
    headers: { Cookie: cookie, Origin: EMDASH_URL },
  });
  if (!res.ok) return;
  // API returns { data: { item: { id: "..." } } }
  const json = (await res.json()) as { data?: { item?: { id?: string } } };
  const id = json.data?.item?.id;
  if (!id) return;

  await fetch(`${EMDASH_API}/content/${collection}/${id}/publish`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "X-EmDash-Request": "1",
      Origin: EMDASH_URL,
    },
  });
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

/**
 * Ensure the adornments collection exists in EmDash.
 * Creates it via schema API if missing. Safe to call multiple times.
 */
async function ensureAdornmentsCollection(cookie: string): Promise<void> {
  // Check if collection already exists
  const checkRes = await fetch(`${EMDASH_API}/content/adornments?limit=1`, {
    headers: { Cookie: cookie, Origin: EMDASH_URL },
  });
  if (checkRes.ok) return; // already exists

  console.log("  Creating adornments collection...");

  // Create the collection
  const createRes = await fetch(`${EMDASH_API}/schema/collections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-EmDash-Request": "1",
      Origin: EMDASH_URL,
    },
    body: JSON.stringify({ slug: "adornments", label: "Adornments", label_singular: "Adornment" }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create adornments collection: ${createRes.status} ${text}`);
  }

  // Add all fields
  const fields = [
    { slug: "name", label: "Name", type: "string" },
    { slug: "file", label: "File", type: "json" },
    { slug: "width", label: "Width", type: "string" },
    { slug: "height", label: "Height", type: "string" },
    { slug: "padding", label: "Padding", type: "string" },
    { slug: "margin", label: "Margin", type: "string" },
    { slug: "top", label: "Top", type: "string" },
    { slug: "right", label: "Right", type: "string" },
    { slug: "bottom", label: "Bottom", type: "string" },
    { slug: "left", label: "Left", type: "string" },
    { slug: "rotation", label: "Rotation", type: "number" },
    { slug: "border", label: "Border", type: "string" },
    { slug: "filter", label: "Filter", type: "string" },
  ];

  for (const field of fields) {
    const res = await fetch(`${EMDASH_API}/schema/collections/adornments/fields`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-EmDash-Request": "1",
        Origin: EMDASH_URL,
      },
      body: JSON.stringify(field),
    });
    if (!res.ok) {
      console.warn(`  ⚠ Failed to create field ${field.slug}: ${res.status}`);
    }
  }
  console.log("  ✓ adornments collection created");
}

// ─── Reset helpers ────────────────────────────────────────────────────────────

async function permanentDeleteById(collection: string, id: string, cookie: string): Promise<void> {
  await fetch(`${EMDASH_API}/content/${collection}/${id}/permanent`, {
    method: "DELETE",
    headers: { Cookie: cookie, "X-EmDash-Request": "1", Origin: EMDASH_URL },
  });
}

async function deleteAllContent(collection: string, cookie: string): Promise<void> {
  let total = 0;

  // Phase 1: permanently delete already-trashed items
  while (true) {
    const res = await fetch(`${EMDASH_API}/content/${collection}/trash?limit=100`, {
      headers: { Cookie: cookie, Origin: EMDASH_URL },
    });
    if (!res.ok) break;
    const json = (await res.json()) as { data?: { items?: Array<{ id: string }> } };
    const items = json.data?.items ?? [];
    if (items.length === 0) break;
    for (const item of items) {
      await permanentDeleteById(collection, item.id, cookie);
    }
    total += items.length;
  }

  // Phase 2: soft-delete then permanently delete active published items
  while (true) {
    const res = await fetch(`${EMDASH_API}/content/${collection}?status=published&limit=100`, {
      headers: { Cookie: cookie, Origin: EMDASH_URL },
    });
    if (!res.ok) break;
    const json = (await res.json()) as { data?: { items?: Array<{ id: string }> } };
    const items = json.data?.items ?? [];
    if (items.length === 0) break;
    for (const item of items) {
      // Soft-delete first (moves to trash), then permanently delete
      await fetch(`${EMDASH_API}/content/${collection}/${item.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie, "X-EmDash-Request": "1", Origin: EMDASH_URL },
      });
      await permanentDeleteById(collection, item.id, cookie);
    }
    total += items.length;
  }

  console.log(`  ✓ Deleted ${total} items from ${collection}`);
}

async function resetAllContent(cookie: string): Promise<void> {
  console.log("\n--- Resetting all content ---");
  // Only delete multi-item collections; singletons (site, sidebar, homepage) cannot be
  // re-created after soft-delete due to unique slug constraints — they are updated in-place.
  for (const collection of ["pages", "adornments"]) {
    await deleteAllContent(collection, cookie);
  }
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedSite(
  urlMap: Map<string, string>,
  cookie: string,
  forceUpdate = false
): Promise<void> {
  console.log("\n--- Seeding site ---");

  const site = db
    .prepare<[], { background_color: string }>(
      "SELECT background_color FROM sites WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();

  if (!site) {
    console.log("  No published site found");
    return;
  }

  if (forceUpdate) {
    const result = await restoreOrUpdateSingleton(
      "site",
      "site",
      { data: { background_color: site.background_color } },
      cookie
    );
    if (result !== "not_found") {
      await publishContent("site", "site", cookie);
      console.log(`  ✓ site ${result}`);
      return;
    }
    // Fall through to create if not found in trash or published
  } else {
    const exists = await contentExists("site", "site", cookie);
    if (exists) {
      console.log("  site already exists, skipping");
      return;
    }
  }

  await createContent(
    "site",
    {
      slug: "site",
      data: { background_color: site.background_color },
      status: "published",
    },
    cookie
  );
  await publishContent("site", "site", cookie);
  console.log("  ✓ site seeded");
}

async function seedAdornmentLibrary(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding adornment library ---");

  type AdornmentRow = {
    id: number;
    name: string;
    width: string | null;
    height: string | null;
    rotation: number | null;
    top: string | null;
    left: string | null;
    right: string | null;
    bottom: string | null;
    border: string | null;
    filter: string | null;
    padding: string | null;
    margin: string | null;
    file_url: string;
    alternative_text: string | null;
  };

  const adornments = db
    .prepare<[], AdornmentRow>(
      `SELECT a.id, a.name,
              csm.width, csm.height, csm.rotation, csm.top, csm.left,
              csm.right, csm.bottom, csm.border, csm.filter, csm.padding, csm.margin,
              f.url as file_url, f.alternative_text
       FROM adornments a
       JOIN adornments_cmps ac ON ac.entity_id = a.id AND ac.component_type = 'shared.media'
       JOIN components_shared_media csm ON csm.id = ac.cmp_id
       JOIN files_related_mph frm ON frm.related_id = csm.id AND frm.related_type = 'shared.media'
       JOIN files f ON f.id = frm.file_id
       WHERE a.published_at IS NOT NULL`
    )
    .all();

  console.log(`  Found ${adornments.length} adornments`);

  for (const a of adornments) {
    const exists = await contentExists("adornments", slugify(a.name), cookie);
    if (exists) {
      console.log(`  adornment/${a.name} already exists, skipping`);
      continue;
    }

    const emdashUrl = urlMap.get(a.file_url) ?? a.file_url;

    await createContent(
      "adornments",
      {
        slug: slugify(a.name),
        data: {
          name: a.name,
          file: { url: emdashUrl, alt: a.alternative_text ?? null },
          width: a.width ?? null,
          height: a.height ?? null,
          padding: a.padding ?? null,
          margin: a.margin ?? null,
          top: a.top ?? null,
          right: a.right ?? null,
          bottom: a.bottom ?? null,
          left: a.left ?? null,
          rotation: a.rotation ?? null,
          border: a.border ?? null,
          filter: a.filter ?? null,
        },
        status: "published",
      },
      cookie
    );
    await publishContent("adornments", slugify(a.name), cookie);
    console.log(`  ✓ adornment/${a.name}`);
  }
}

async function seedPages(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding pages ---");

  const pages = db
    .prepare<[], { id: number; slug: string }>(
      `SELECT id, slug FROM pages
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
      {
        slug: page.slug,
        // title is required by EmDash's pre-seeded pages schema
        // seo goes in data.seo (json field) — pages collection doesn't have SEO feature enabled
        data: { title: page.slug, page_slug: page.slug, blocks, ...(seo ? { seo } : {}) },
        status: "published",
      },
      cookie
    );
    await publishContent("pages", page.slug, cookie);
    console.log(`  ✓ page/${page.slug}`);
  }
}

async function seedSidebar(
  urlMap: Map<string, string>,
  cookie: string,
  forceUpdate = false
): Promise<void> {
  console.log("\n--- Seeding sidebar ---");

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

  const categories = categoryCmps
    .map(({ cmp_id }) => {
      const cat = db
        .prepare<[number], { id: number; category_title: string }>(
          "SELECT id, category_title FROM components_shared_sidebar_categories WHERE id = ?"
        )
        .get(cmp_id);

      if (!cat) return null;

      const bgFile = db
        .prepare<[number], StrapiFile>(
          `SELECT f.url, f.alternative_text as alternativeText
           FROM files f
           JOIN files_related_mph frm ON f.id = frm.file_id
           WHERE frm.related_id = ? AND frm.related_type = 'shared.sidebar-category'
           AND frm.field = 'backgroundImage' LIMIT 1`
        )
        .get(cat.id);

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
    })
    .filter(Boolean);

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

  const sidebarData = { top_image: topImage, categories, links };

  if (forceUpdate) {
    const result = await restoreOrUpdateSingleton("sidebar", "sidebar", { data: sidebarData }, cookie);
    if (result !== "not_found") {
      await publishContent("sidebar", "sidebar", cookie);
      console.log(`  ✓ sidebar ${result}`);
      return;
    }
  } else {
    const exists = await contentExists("sidebar", "sidebar", cookie);
    if (exists) {
      console.log("  sidebar already exists, skipping");
      return;
    }
  }

  await createContent(
    "sidebar",
    {
      slug: "sidebar",
      data: sidebarData,
      status: "published",
    },
    cookie
  );
  await publishContent("sidebar", "sidebar", cookie);
  console.log("  ✓ sidebar seeded");
}

async function seedHomepage(
  urlMap: Map<string, string>,
  cookie: string,
  forceUpdate = false
): Promise<void> {
  console.log("\n--- Seeding homepage ---");

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
  const homepageData = { blocks, ...(seo ? { seo } : {}) };

  if (forceUpdate) {
    const result = await restoreOrUpdateSingleton("homepage", "homepage", { data: homepageData }, cookie);
    if (result !== "not_found") {
      await publishContent("homepage", "homepage", cookie);
      console.log(`  ✓ homepage ${result}`);
      return;
    }
  } else {
    const exists = await contentExists("homepage", "homepage", cookie);
    if (exists) {
      console.log("  homepage already exists, skipping");
      return;
    }
  }

  await createContent(
    "homepage",
    { slug: "homepage", data: homepageData, status: "published" },
    cookie
  );
  await publishContent("homepage", "homepage", cookie);
  console.log("  ✓ homepage seeded");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doReset = args.includes("--reset");

  console.log("Strapi → EmDash migration\n");
  console.log(`DB: ${DB_PATH}`);
  console.log(`Uploads: ${UPLOADS_PATH}`);
  console.log(`EmDash: ${EMDASH_URL}`);
  if (doReset) console.log("Mode: --reset (will wipe existing content)\n");
  else console.log("Mode: incremental (skips existing)\n");

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Strapi DB not found at ${DB_PATH}`);
  }
  if (!fs.existsSync(UPLOADS_PATH)) {
    throw new Error(`Uploads not found at ${UPLOADS_PATH}`);
  }

  const cookie = await getSessionCookie();
  console.log("✓ Authenticated with EmDash\n");

  // Ensure adornments collection exists (creates it if missing)
  console.log("--- Ensuring schema ---");
  await ensureAdornmentsCollection(cookie);

  if (doReset) {
    await resetAllContent(cookie);
  }

  const urlMap = await uploadAllMedia(cookie);
  console.log(`\n✓ Uploaded ${urlMap.size} media files`);

  await seedSite(urlMap, cookie, doReset);
  await seedAdornmentLibrary(urlMap, cookie);
  await seedPages(urlMap, cookie);
  await seedSidebar(urlMap, cookie, doReset);
  await seedHomepage(urlMap, cookie, doReset);

  console.log("\n✓ Migration complete!");
  db.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
