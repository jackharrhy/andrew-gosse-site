// scripts/migrate-from-strapi-to-teacms.ts
/**
 * Migration: Strapi backup → TeaCMS SQLite
 *
 * Reads from:
 *   tmp/backups/andrewsite_strapi_data/data.db
 *   tmp/backups/andrewsite_strapi_uploads/
 *
 * Writes to:
 *   data/tea.db
 *   data/uploads/
 *
 * Usage:
 *   npx tsx scripts/migrate-from-strapi-to-teacms.ts [--reset]
 */
import Database from "better-sqlite3";
import { ulid } from "ulid";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import bcrypt from "bcryptjs";
import { applySchema } from "../src/tea/db/schema.js";
import { markdownToBlocks } from "./markdown-to-blocks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const STRAPI_DB = join(ROOT, "tmp/backups/andrewsite_strapi_data/data.db");
const STRAPI_UPLOADS = join(ROOT, "tmp/backups/andrewsite_strapi_uploads");
const TEA_DB = join(ROOT, "data/tea.db");
const TEA_UPLOADS = join(ROOT, "data/uploads");

const RESET = process.argv.includes("--reset");

const RESIZED_PREFIXES = ["large_", "medium_", "small_", "thumbnail_"];

function isResizedVariant(filename: string): boolean {
  return RESIZED_PREFIXES.some((p) => filename.startsWith(p));
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
  };
  return map[ext] ?? "application/octet-stream";
}

interface StrapiFile {
  id: number;
  name: string;
  url: string;
  alternativeText: string | null;
}

interface CmpRow {
  entity_id: number;
  cmp_id: number;
  component_type: string;
  field: string;
  order: number;
}

interface StrapiMediaComponent {
  id: number;
  width: string | null;
  height: string | null;
  border: string | null;
  rotation: number | null;
  top: string | null;
  bottom: string | null;
  left: string | null;
  right: string | null;
  filter: string | null;
  padding: string | null;
  margin: string | null;
}

async function main() {
  console.log("Strapi → TeaCMS migration\n");

  mkdirSync(join(ROOT, "data"), { recursive: true });
  mkdirSync(TEA_UPLOADS, { recursive: true });

  const strapi = new Database(STRAPI_DB, { readonly: true });
  const tea = new Database(TEA_DB);
  tea.pragma("journal_mode = WAL");
  tea.pragma("foreign_keys = ON");

  if (RESET) {
    console.log("--- Reset: dropping all tables ---");
    const tables = tea
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all();
    for (const t of tables) {
      tea.exec(`DROP TABLE IF EXISTS "${t.name}"`);
    }
  }

  applySchema(tea);

  // ── Seed users ──────────────────────────────────────────────────────────────
  console.log("\n--- Seeding admin users ---");
  const seedUser = async (email: string | undefined, password: string | undefined) => {
    if (!email || !password) return;
    const exists = tea.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (exists) {
      console.log(`  ✓ User ${email} already exists`);
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    tea.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, hash);
    console.log(`  ✓ Created user ${email}`);
  };
  await seedUser(process.env.TEA_ADMIN_EMAIL_1, process.env.TEA_ADMIN_PASSWORD_1);
  await seedUser(process.env.TEA_ADMIN_EMAIL_2, process.env.TEA_ADMIN_PASSWORD_2);

  // ── Migrate media files ────────────────────────────────────────────────────
  console.log("\n--- Migrating media ---");
  const fileIdMap = new Map<number, string>();
  const fileUrlMap = new Map<string, string>();

  const insertMedia = tea.prepare(
    "INSERT INTO media (id, filename, mime_type, size, path, alt) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const strapiFiles = strapi
    .prepare<[], StrapiFile>(
      "SELECT id, name, url, alternative_text as alternativeText FROM files"
    )
    .all();

  for (const f of strapiFiles) {
    if (!f.url) continue;
    const filename = basename(f.url);
    if (isResizedVariant(filename)) continue;
    const src = join(STRAPI_UPLOADS, filename);
    if (!statSync(src, { throwIfNoEntry: false })) {
      console.warn(`  ⚠ Source missing: ${filename}`);
      continue;
    }
    const id = ulid();
    const ext = extname(filename);
    const storedFilename = `${id}${ext}`;
    const dest = join(TEA_UPLOADS, storedFilename);
    copyFileSync(src, dest);
    const stat = statSync(dest);
    insertMedia.run(
      id,
      f.name || filename,
      getMimeType(filename),
      stat.size,
      storedFilename,
      f.alternativeText
    );
    fileIdMap.set(f.id, id);
    fileUrlMap.set(f.url, id);
  }
  console.log(`  ✓ Migrated ${fileIdMap.size} media files`);

  function getMediaIdForComponent(componentId: number, relatedType: string): string | null {
    const row = strapi
      .prepare<[number, string], { file_id: number }>(
        `SELECT frm.file_id FROM files_related_mph frm
         WHERE frm.related_id = ? AND frm.related_type = ? AND frm.field = 'file'
         LIMIT 1`
      )
      .get(componentId, relatedType);
    if (!row) return null;
    return fileIdMap.get(row.file_id) ?? null;
  }

  // ── Migrate adornments ─────────────────────────────────────────────────────
  console.log("\n--- Migrating adornments ---");
  const insertAdornment = tea.prepare(
    "INSERT INTO adornments (id, name, media_id, css) VALUES (?, ?, ?, ?)"
  );

  interface AdornmentRow {
    id: number;
    name: string;
    media_cmp_id: number | null;
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
  }

  const adornments = strapi
    .prepare<[], AdornmentRow>(
      `SELECT a.id, a.name, csm.id as media_cmp_id,
              csm.width, csm.height, csm.rotation, csm.top, csm.left,
              csm.right, csm.bottom, csm.border, csm.filter, csm.padding, csm.margin
       FROM adornments a
       JOIN adornments_cmps ac ON ac.entity_id = a.id AND ac.component_type = 'shared.media'
       JOIN components_shared_media csm ON csm.id = ac.cmp_id
       WHERE a.published_at IS NOT NULL`
    )
    .all();

  for (const a of adornments) {
    const mediaId = a.media_cmp_id
      ? getMediaIdForComponent(a.media_cmp_id, "shared.media")
      : null;
    const css: Record<string, unknown> = {};
    if (a.width) css.width = a.width;
    if (a.height) css.height = a.height;
    if (a.padding) css.padding = a.padding;
    if (a.margin) css.margin = a.margin;
    if (a.top) css.top = a.top;
    if (a.right) css.right = a.right;
    if (a.bottom) css.bottom = a.bottom;
    if (a.left) css.left = a.left;
    if (a.rotation != null) css.rotation = a.rotation;
    if (a.border) css.border = a.border;
    if (a.filter) css.filter = a.filter;

    insertAdornment.run(ulid(), a.name, mediaId, JSON.stringify(css));
  }
  console.log(`  ✓ Migrated ${adornments.length} adornments`);

  function getAdornmentNamesForMedia(mediaCmpId: number): { adornmentName: string }[] {
    const rows = strapi
      .prepare<[number], { name: string }>(
        `SELECT a.name FROM components_shared_media_adornments_lnk lnk
         JOIN adornments a ON a.id = lnk.adornment_id
         WHERE lnk.media_id = ? AND a.published_at IS NOT NULL
         ORDER BY lnk.adornment_ord`
      )
      .all(mediaCmpId);
    return rows.map((r) => ({ adornmentName: r.name }));
  }

  function buildBlocks(cmps: CmpRow[]): unknown[] {
    const blockCmps = cmps
      .filter((c) => c.field === "blocks")
      .sort((a, b) => a.order - b.order);

    const result: unknown[] = [];

    for (const cmp of blockCmps) {
      if (cmp.component_type === "shared.rich-text") {
        const row = strapi
          .prepare<[number], { body: string }>(
            "SELECT body FROM components_shared_rich_texts WHERE id = ?"
          )
          .get(cmp.cmp_id);
        if (!row || !row.body) continue;
        // Convert markdown (possibly with embedded HTML) into native blocks.
        // Anything containing raw HTML falls through to a `markdown` escape
        // hatch block so the styling is preserved exactly.
        const converted = markdownToBlocks(row.body);
        for (const b of converted) result.push(b);
        continue;
      }
      if (cmp.component_type === "shared.media") {
        const media = strapi
          .prepare<[number], StrapiMediaComponent>(
            "SELECT * FROM components_shared_media WHERE id = ?"
          )
          .get(cmp.cmp_id);
        if (!media) continue;
        const mediaId = getMediaIdForComponent(media.id, "shared.media");
        const adornments = getAdornmentNamesForMedia(media.id);
        const file = strapi
          .prepare<[number], StrapiFile>(
            `SELECT f.id, f.name, f.url, f.alternative_text as alternativeText
             FROM files f
             JOIN files_related_mph frm ON f.id = frm.file_id
             WHERE frm.related_id = ? AND frm.related_type = 'shared.media' AND frm.field = 'file' LIMIT 1`
          )
          .get(media.id);
        result.push({
          id: ulid(),
          type: "media",
          props: {
            mediaId: mediaId ?? "",
            alt: file?.alternativeText ?? "",
            width: media.width ?? "",
            height: media.height ?? "",
            padding: media.padding ?? "",
            margin: media.margin ?? "",
            top: media.top ?? "",
            right: media.right ?? "",
            bottom: media.bottom ?? "",
            left: media.left ?? "",
            rotation: media.rotation != null ? String(media.rotation) : "",
            border: media.border ?? "",
            filter: media.filter ?? "",
            adornments: JSON.stringify(adornments),
          },
          content: [],
          children: [],
        });
        continue;
      }
      if (cmp.component_type === "shared.special-component") {
        const row = strapi
          .prepare<[number], { type: string }>(
            "SELECT type FROM components_shared_special_components WHERE id = ?"
          )
          .get(cmp.cmp_id);
        if (!row) continue;
        result.push({
          id: ulid(),
          type: "special",
          props: { type: row.type.replace(/-/g, "_") },
          content: [],
          children: [],
        });
      }
    }
    return result;
  }

  // ── Site config ────────────────────────────────────────────────────────────
  console.log("\n--- Migrating site config ---");
  const site = strapi
    .prepare<[], { background_color: string }>(
      "SELECT background_color FROM sites WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();
  if (site) {
    tea
      .prepare(
        "UPDATE site SET background_color = ?, updated_at = datetime('now') WHERE id = 'site'"
      )
      .run(site.background_color);
    console.log(`  ✓ Site background_color = ${site.background_color}`);
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  console.log("\n--- Migrating sidebar ---");
  const strapiSidebar = strapi
    .prepare<[], { id: number }>(
      "SELECT id FROM sidebars WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();

  if (strapiSidebar) {
    const topImageRow = strapi
      .prepare<[number], { file_id: number }>(
        `SELECT frm.file_id FROM files_related_mph frm
         WHERE frm.related_id = ? AND frm.related_type = 'api::sidebar.sidebar' AND frm.field = 'topImage'
         LIMIT 1`
      )
      .get(strapiSidebar.id);
    const topImageId = topImageRow ? fileIdMap.get(topImageRow.file_id) ?? null : null;

    const categoryCmps = strapi
      .prepare<[number], { cmp_id: number; order: number }>(
        `SELECT cmp_id, [order] FROM sidebars_cmps
         WHERE entity_id = ? AND component_type = 'shared.sidebar-category'
         ORDER BY [order]`
      )
      .all(strapiSidebar.id);

    const categories = categoryCmps
      .map(({ cmp_id }) => {
        const cat = strapi
          .prepare<[number], { id: number; category_title: string }>(
            "SELECT id, category_title FROM components_shared_sidebar_categories WHERE id = ?"
          )
          .get(cmp_id);
        if (!cat) return null;
        const bgRow = strapi
          .prepare<[number], { file_id: number }>(
            `SELECT frm.file_id FROM files_related_mph frm
             WHERE frm.related_id = ? AND frm.related_type = 'shared.sidebar-category'
             AND frm.field = 'backgroundImage' LIMIT 1`
          )
          .get(cat.id);
        const backgroundImageId = bgRow ? fileIdMap.get(bgRow.file_id) ?? null : null;

        const itemCmps = strapi
          .prepare<[number], { cmp_id: number; order: number }>(
            `SELECT cmp_id, [order]
             FROM components_shared_sidebar_categories_cmps
             WHERE entity_id = ? AND component_type = 'shared.sidebar-item'
             ORDER BY [order]`
          )
          .all(cat.id);

        const items = itemCmps
          .map(({ cmp_id: itemCmpId }) => {
            const item = strapi
              .prepare<[number], { id: number; text: string }>(
                "SELECT id, text FROM components_shared_sidebar_items WHERE id = ?"
              )
              .get(itemCmpId);
            if (!item) return null;
            const pageLink = strapi
              .prepare<[number], { slug: string }>(
                `SELECT p.slug FROM pages p
                 JOIN components_shared_sidebar_items_page_lnk lnk ON lnk.page_id = p.id
                 WHERE lnk.sidebar_item_id = ?
                 AND p.published_at IS NOT NULL
                 ORDER BY p.id DESC LIMIT 1`
              )
              .get(item.id);
            return {
              text: item.text,
              pageSlug: pageLink?.slug ?? "",
            };
          })
          .filter((x): x is { text: string; pageSlug: string } => x !== null);

        return {
          categoryTitle: cat.category_title,
          backgroundImageId,
          items,
        };
      })
      .filter((x) => x !== null);

    const linkCmps = strapi
      .prepare<[number], { cmp_id: number }>(
        `SELECT cmp_id FROM sidebars_cmps
         WHERE entity_id = ? AND component_type = 'shared.sidebar-link'
         ORDER BY [order]`
      )
      .all(strapiSidebar.id);

    const links = linkCmps
      .map(({ cmp_id }) => {
        const row = strapi
          .prepare<[number], { service: string; url: string }>(
            "SELECT service, url FROM components_shared_sidebar_links WHERE id = ?"
          )
          .get(cmp_id);
        return row ? { service: row.service, url: row.url } : null;
      })
      .filter((x): x is { service: string; url: string } => x !== null);

    tea
      .prepare(
        `UPDATE sidebar SET top_image_id = ?, categories = ?, links = ?,
         updated_at = datetime('now') WHERE id = 'sidebar'`
      )
      .run(topImageId, JSON.stringify(categories), JSON.stringify(links));
    console.log(`  ✓ Sidebar: ${categories.length} categories, ${links.length} links`);
  }

  // ── Pages ──────────────────────────────────────────────────────────────────
  console.log("\n--- Migrating pages ---");
  const strapiPages = strapi
    .prepare<[], { id: number; slug: string }>(
      `SELECT id, slug FROM pages
       WHERE published_at IS NOT NULL
       GROUP BY slug
       HAVING id = MAX(id)
       ORDER BY id`
    )
    .all();

  const insertPage = tea.prepare(
    `INSERT INTO pages (id, slug, title, blocks, seo_title, seo_description, seo_image_id, seo_no_index, seo_canonical)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const sp of strapiPages) {
    const cmps = strapi
      .prepare<[number], CmpRow>(
        `SELECT entity_id, cmp_id, component_type, field, [order]
         FROM pages_cmps WHERE entity_id = ? ORDER BY [order]`
      )
      .all(sp.id);

    const blocks = buildBlocks(cmps);

    const seoCmp = cmps.find((c) => c.field === "seo" && c.component_type === "shared.seo");
    let seoTitle: string | null = null;
    let seoDescription: string | null = null;
    let seoImageId: string | null = null;
    if (seoCmp) {
      const seoRow = strapi
        .prepare<[number], { meta_title: string | null; meta_description: string | null }>(
          "SELECT meta_title, meta_description FROM components_shared_seos WHERE id = ?"
        )
        .get(seoCmp.cmp_id);
      seoTitle = seoRow?.meta_title ?? null;
      seoDescription = seoRow?.meta_description ?? null;
      const shareRow = strapi
        .prepare<[number], { file_id: number }>(
          `SELECT frm.file_id FROM files_related_mph frm
           WHERE frm.related_id = ? AND frm.related_type = 'shared.seos' AND frm.field = 'shareImage' LIMIT 1`
        )
        .get(seoCmp.cmp_id);
      if (shareRow) seoImageId = fileIdMap.get(shareRow.file_id) ?? null;
    }

    const slugTitle = sp.slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    insertPage.run(
      ulid(),
      sp.slug,
      seoTitle ?? slugTitle,
      JSON.stringify(blocks),
      seoTitle,
      seoDescription,
      seoImageId,
      0,
      null
    );
    console.log(`  ✓ ${sp.slug} (${blocks.length} blocks)`);
  }

  // ── Homepage ───────────────────────────────────────────────────────────────
  console.log("\n--- Migrating homepage ---");
  const homepage = strapi
    .prepare<[], { id: number }>(
      "SELECT id FROM homepages WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
    .get();
  if (homepage) {
    const cmps = strapi
      .prepare<[number], CmpRow>(
        `SELECT entity_id, cmp_id, component_type, field, [order]
         FROM homepages_cmps WHERE entity_id = ? ORDER BY [order]`
      )
      .all(homepage.id);
    const blocks = buildBlocks(cmps);
    tea
      .prepare(
        "UPDATE homepage SET blocks = ?, updated_at = datetime('now') WHERE id = 'homepage'"
      )
      .run(JSON.stringify(blocks));
    console.log(`  ✓ Homepage (${blocks.length} blocks)`);
  }

  console.log("\n✓ Migration complete");
  strapi.close();
  tea.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
