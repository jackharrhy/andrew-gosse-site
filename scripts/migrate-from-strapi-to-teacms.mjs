// scripts/migrate-from-strapi-to-teacms.mjs
/**
 * Migration: Strapi backup → TeaCMS SQLite
 *
 * Reads from:
 *   tmp/backups/andrewsite_strapi_data/data.db
 *   tmp/backups/andrewsite_strapi_uploads/
 *
 * Writes to:
 *   A new directory explicitly supplied with --target-dir
 *
 * Usage:
 *   npm run tea:import -- --source-db PATH --source-uploads PATH --target-dir NEW_DIRECTORY
 */
import { DatabaseSync as Database } from "node:sqlite";
import { randomUUID as ulid } from "node:crypto";
import { copyFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";
import bcrypt from "bcryptjs";
import { openDatabase } from "../app/data/database.ts";
import { markdownToBlocks } from "./markdown-to-blocks.ts";
function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--"))
    throw new Error(
      "Required: --source-db PATH --source-uploads PATH --target-dir NEW_DIRECTORY",
    );
  return resolve(value);
}
const STRAPI_DB = argument("--source-db");
const STRAPI_UPLOADS = argument("--source-uploads");
const TARGET = argument("--target-dir");
if (existsSync(TARGET))
  throw new Error("Target already exists. Import only into a new directory.");
if (!statSync(STRAPI_DB).isFile() || !statSync(STRAPI_UPLOADS).isDirectory())
  throw new Error("Invalid source backup");
const TEA_DB = join(TARGET, "tea.db");
const TEA_UPLOADS = join(TARGET, "uploads");
const RESIZED_PREFIXES = ["large_", "medium_", "small_", "thumbnail_"];
function isResizedVariant(filename) {
  return RESIZED_PREFIXES.some((p) => filename.startsWith(p));
}
function getMimeType(filename) {
  const ext = extname(filename).toLowerCase();
  const map = {
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
async function main() {
  console.log("Strapi → TeaCMS migration\n");
  mkdirSync(TARGET, { recursive: true });
  mkdirSync(TEA_UPLOADS, { recursive: true });
  const strapi = new Database(STRAPI_DB, { readOnly: true });
  const { sqlite: tea } = await openDatabase(TEA_DB);
  // ── Seed users ──────────────────────────────────────────────────────────────
  console.log("\n--- Seeding admin users ---");
  const seedUser = async (email, password) => {
    if (!email || !password) return;
    if (password.length < 12)
      throw new Error(
        "Import account passwords must have at least 12 characters.",
      );
    const exists = tea
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (exists) {
      console.log(`  ✓ User ${email} already exists`);
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    tea
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .run(email, hash);
    console.log(`  ✓ Created user ${email}`);
  };
  await seedUser(
    process.env.TEA_ADMIN_EMAIL_1,
    process.env.TEA_ADMIN_PASSWORD_1,
  );
  await seedUser(
    process.env.TEA_ADMIN_EMAIL_2,
    process.env.TEA_ADMIN_PASSWORD_2,
  );
  // ── Migrate media files ────────────────────────────────────────────────────
  console.log("\n--- Migrating media ---");
  tea.exec("BEGIN IMMEDIATE");
  const fileIdMap = new Map();
  const fileUrlMap = new Map();
  const insertMedia = tea.prepare(
    "INSERT INTO media (id, filename, mime_type, size, path, alt) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const strapiFiles = strapi
    .prepare(
      "SELECT id, name, url, alternative_text as alternativeText FROM files",
    )
    .all();
  for (const f of strapiFiles) {
    if (!f.url) continue;
    const filename = basename(f.url);
    if (isResizedVariant(filename)) continue;
    const src = join(STRAPI_UPLOADS, filename);
    if (!statSync(src, { throwIfNoEntry: false })) {
      throw new Error(
        `Source file missing: ${filename}. Import stopped; the new target is incomplete.`,
      );
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
      f.alternativeText,
    );
    fileIdMap.set(f.id, id);
    fileUrlMap.set(f.url, id);
  }
  console.log(`  ✓ Migrated ${fileIdMap.size} media files`);
  function getMediaIdForComponent(componentId, relatedType) {
    const row = strapi
      .prepare(
        `SELECT frm.file_id FROM files_related_mph frm
         WHERE frm.related_id = ? AND frm.related_type = ? AND frm.field = 'file'
         LIMIT 1`,
      )
      .get(componentId, relatedType);
    if (!row) return null;
    return fileIdMap.get(row.file_id) ?? null;
  }
  // ── Migrate adornments ─────────────────────────────────────────────────────
  console.log("\n--- Migrating adornments ---");
  const insertAdornment = tea.prepare(
    "INSERT INTO adornments (id, name, media_id, css) VALUES (?, ?, ?, ?)",
  );
  const adornments = strapi
    .prepare(
      `SELECT a.id, a.name, csm.id as media_cmp_id,
              csm.width, csm.height, csm.rotation, csm.top, csm.left,
              csm.right, csm.bottom, csm.border, csm.filter, csm.padding, csm.margin
       FROM adornments a
       JOIN adornments_cmps ac ON ac.entity_id = a.id AND ac.component_type = 'shared.media'
       JOIN components_shared_media csm ON csm.id = ac.cmp_id
       WHERE a.published_at IS NOT NULL`,
    )
    .all();
  for (const a of adornments) {
    const mediaId = a.media_cmp_id
      ? getMediaIdForComponent(a.media_cmp_id, "shared.media")
      : null;
    const css = {};
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
  function getAdornmentNamesForMedia(mediaCmpId) {
    const rows = strapi
      .prepare(
        `SELECT a.name FROM components_shared_media_adornments_lnk lnk
         JOIN adornments a ON a.id = lnk.adornment_id
         WHERE lnk.media_id = ? AND a.published_at IS NOT NULL
         ORDER BY lnk.adornment_ord`,
      )
      .all(mediaCmpId);
    return rows.map((r) => ({ adornmentName: r.name }));
  }
  function buildBlocks(cmps) {
    const blockCmps = cmps
      .filter((c) => c.field === "blocks")
      .sort((a, b) => a.order - b.order);
    const result = [];
    for (const cmp of blockCmps) {
      if (cmp.component_type === "shared.rich-text") {
        const row = strapi
          .prepare("SELECT body FROM components_shared_rich_texts WHERE id = ?")
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
          .prepare("SELECT * FROM components_shared_media WHERE id = ?")
          .get(cmp.cmp_id);
        if (!media) continue;
        const mediaId = getMediaIdForComponent(media.id, "shared.media");
        const adornments = getAdornmentNamesForMedia(media.id);
        const file = strapi
          .prepare(
            `SELECT f.id, f.name, f.url, f.alternative_text as alternativeText
             FROM files f
             JOIN files_related_mph frm ON f.id = frm.file_id
             WHERE frm.related_id = ? AND frm.related_type = 'shared.media' AND frm.field = 'file' LIMIT 1`,
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
          .prepare(
            "SELECT type FROM components_shared_special_components WHERE id = ?",
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
    .prepare(
      "SELECT background_color FROM sites WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1",
    )
    .get();
  if (site) {
    tea
      .prepare(
        "UPDATE site SET background_color = ?, updated_at = datetime('now') WHERE id = 'site'",
      )
      .run(site.background_color);
    console.log(`  ✓ Site background_color = ${site.background_color}`);
  }
  // ── Sidebar ────────────────────────────────────────────────────────────────
  console.log("\n--- Migrating sidebar ---");
  const strapiSidebar = strapi
    .prepare(
      "SELECT id FROM sidebars WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1",
    )
    .get();
  if (strapiSidebar) {
    const topImageRow = strapi
      .prepare(
        `SELECT frm.file_id FROM files_related_mph frm
         WHERE frm.related_id = ? AND frm.related_type = 'api::sidebar.sidebar' AND frm.field = 'topImage'
         LIMIT 1`,
      )
      .get(strapiSidebar.id);
    const topImageId = topImageRow
      ? (fileIdMap.get(topImageRow.file_id) ?? null)
      : null;
    const categoryCmps = strapi
      .prepare(
        `SELECT cmp_id, [order] FROM sidebars_cmps
         WHERE entity_id = ? AND component_type = 'shared.sidebar-category'
         ORDER BY [order]`,
      )
      .all(strapiSidebar.id);
    const categories = categoryCmps
      .map(({ cmp_id }) => {
        const cat = strapi
          .prepare(
            "SELECT id, category_title FROM components_shared_sidebar_categories WHERE id = ?",
          )
          .get(cmp_id);
        if (!cat) return null;
        const bgRow = strapi
          .prepare(
            `SELECT frm.file_id FROM files_related_mph frm
             WHERE frm.related_id = ? AND frm.related_type = 'shared.sidebar-category'
             AND frm.field = 'backgroundImage' LIMIT 1`,
          )
          .get(cat.id);
        const backgroundImageId = bgRow
          ? (fileIdMap.get(bgRow.file_id) ?? null)
          : null;
        const itemCmps = strapi
          .prepare(
            `SELECT cmp_id, [order]
             FROM components_shared_sidebar_categories_cmps
             WHERE entity_id = ? AND component_type = 'shared.sidebar-item'
             ORDER BY [order]`,
          )
          .all(cat.id);
        const items = itemCmps
          .map(({ cmp_id: itemCmpId }) => {
            const item = strapi
              .prepare(
                "SELECT id, text FROM components_shared_sidebar_items WHERE id = ?",
              )
              .get(itemCmpId);
            if (!item) return null;
            const pageLink = strapi
              .prepare(
                `SELECT p.slug FROM pages p
                 JOIN components_shared_sidebar_items_page_lnk lnk ON lnk.page_id = p.id
                 WHERE lnk.sidebar_item_id = ?
                 AND p.published_at IS NOT NULL
                 ORDER BY p.id DESC LIMIT 1`,
              )
              .get(item.id);
            return {
              text: item.text,
              pageSlug: pageLink?.slug ?? "",
            };
          })
          .filter((x) => x !== null);
        return {
          categoryTitle: cat.category_title,
          backgroundImageId,
          items,
        };
      })
      .filter((x) => x !== null);
    const linkCmps = strapi
      .prepare(
        `SELECT cmp_id FROM sidebars_cmps
         WHERE entity_id = ? AND component_type = 'shared.sidebar-link'
         ORDER BY [order]`,
      )
      .all(strapiSidebar.id);
    const links = linkCmps
      .map(({ cmp_id }) => {
        const row = strapi
          .prepare(
            "SELECT service, url FROM components_shared_sidebar_links WHERE id = ?",
          )
          .get(cmp_id);
        return row ? { service: row.service, url: row.url } : null;
      })
      .filter((x) => x !== null);
    tea
      .prepare(
        `UPDATE sidebar SET top_image_id = ?, categories = ?, links = ?,
         updated_at = datetime('now') WHERE id = 'sidebar'`,
      )
      .run(topImageId, JSON.stringify(categories), JSON.stringify(links));
    console.log(
      `  ✓ Sidebar: ${categories.length} categories, ${links.length} links`,
    );
  }
  // ── Pages ──────────────────────────────────────────────────────────────────
  console.log("\n--- Migrating pages ---");
  const strapiPages = strapi
    .prepare(
      `SELECT id, slug FROM pages
       WHERE published_at IS NOT NULL
       GROUP BY slug
       HAVING id = MAX(id)
       ORDER BY id`,
    )
    .all();
  const insertPage =
    tea.prepare(`INSERT INTO pages (id, slug, title, blocks, seo_title, seo_description, seo_image_id, seo_no_index, seo_canonical)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const sp of strapiPages) {
    const cmps = strapi
      .prepare(
        `SELECT entity_id, cmp_id, component_type, field, [order]
         FROM pages_cmps WHERE entity_id = ? ORDER BY [order]`,
      )
      .all(sp.id);
    const blocks = buildBlocks(cmps);
    const seoCmp = cmps.find(
      (c) => c.field === "seo" && c.component_type === "shared.seo",
    );
    let seoTitle = null;
    let seoDescription = null;
    let seoImageId = null;
    if (seoCmp) {
      const seoRow = strapi
        .prepare(
          "SELECT meta_title, meta_description FROM components_shared_seos WHERE id = ?",
        )
        .get(seoCmp.cmp_id);
      seoTitle = seoRow?.meta_title ?? null;
      seoDescription = seoRow?.meta_description ?? null;
      const shareRow = strapi
        .prepare(
          `SELECT frm.file_id FROM files_related_mph frm
           WHERE frm.related_id = ? AND frm.related_type = 'shared.seos' AND frm.field = 'shareImage' LIMIT 1`,
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
      null,
    );
    console.log(`  ✓ ${sp.slug} (${blocks.length} blocks)`);
  }
  // ── Homepage ───────────────────────────────────────────────────────────────
  console.log("\n--- Migrating homepage ---");
  const homepage = strapi
    .prepare(
      "SELECT id FROM homepages WHERE published_at IS NOT NULL ORDER BY id DESC LIMIT 1",
    )
    .get();
  if (homepage) {
    const cmps = strapi
      .prepare(
        `SELECT entity_id, cmp_id, component_type, field, [order]
         FROM homepages_cmps WHERE entity_id = ? ORDER BY [order]`,
      )
      .all(homepage.id);
    const blocks = buildBlocks(cmps);
    tea
      .prepare(
        "UPDATE homepage SET blocks = ?, updated_at = datetime('now') WHERE id = 'homepage'",
      )
      .run(JSON.stringify(blocks));
    console.log(`  ✓ Homepage (${blocks.length} blocks)`);
  }
  tea.exec("COMMIT");
  console.log("\n✓ Migration complete");
  strapi.close();
  tea.close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
