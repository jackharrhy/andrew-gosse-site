import { getEmDashCollection, getEmDashEntry } from "emdash";
import Database from "better-sqlite3";
import { join } from "node:path";
import type { Block, AdornmentBlock, MediaFile, SidebarCategory, SidebarLink } from "../types/emdash";

// ─── Native SEO type (mirrors EmDash's _emdash_seo table) ────────────────────

export interface NativeSeo {
  title: string | null;
  description: string | null;
  image: string | null;
  canonical: string | null;
  noIndex: boolean;
}

// ─── Collection data interfaces ───────────────────────────────────────────────

export interface HomepageData {
  blocks?: Block[];
}

export interface PageData {
  page_slug: string;
  blocks?: Block[];
}

export interface SidebarData {
  top_image?: { url: string; alt: string | null } | null;
  categories?: SidebarCategory[];
  links?: SidebarLink[];
}

export interface SiteData {
  background_color?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Path to the EmDash SQLite DB — matches astro.config.mjs sqlite({ url: "file:./data/emdash.db" })
const DB_PATH = join(process.cwd(), "data", "emdash.db");

/**
 * Fetch native SEO data from _emdash_seo via direct SQLite.
 * contentIdOrSlug can be either the ULID or the slug — we resolve slug to ULID if needed.
 * Returns null if the DB is unavailable or no SEO row exists.
 */
function fetchNativeSeo(collection: string, contentIdOrSlug: string): NativeSeo | null {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    type SeoRow = {
      seo_title: string | null;
      seo_description: string | null;
      seo_image: string | null;
      seo_canonical: string | null;
      seo_no_index: number;
    };

    // getEmDashEntry returns entry.id = slug (not ULID).
    // _emdash_seo stores content_id = ULID.
    // Resolve slug → ULID first.
    const table = `ec_${collection}`;
    const idRow = db
      .prepare<[string], { id: string }>(`SELECT id FROM "${table}" WHERE slug = ? LIMIT 1`)
      .get(contentIdOrSlug);

    const ulid = idRow?.id ?? contentIdOrSlug;

    const row = db
      .prepare<[string, string], SeoRow>(
        "SELECT seo_title, seo_description, seo_image, seo_canonical, seo_no_index FROM _emdash_seo WHERE collection = ? AND content_id = ? LIMIT 1"
      )
      .get(collection, ulid);
    db.close();
    if (!row) return null;
    return {
      title: row.seo_title,
      description: row.seo_description,
      image: row.seo_image,
      canonical: row.seo_canonical,
      noIndex: row.seo_no_index === 1,
    };
  } catch {
    return null;
  }
}

// ─── Public fetch functions ───────────────────────────────────────────────────

export async function fetchHomepage(): Promise<{ data: HomepageData; seo: NativeSeo | null }> {
  const { entry } = await getEmDashEntry("homepage", "homepage");
  if (!entry) throw new Error("Homepage not found");
  const seo = fetchNativeSeo("homepage", entry.id);
  return { data: entry.data as HomepageData, seo };
}

export async function fetchPages(): Promise<PageData[]> {
  const { entries } = await getEmDashCollection("pages");
  return entries.map((e) => e.data as PageData);
}

export async function fetchPage(slug: string): Promise<{ data: PageData; seo: NativeSeo | null } | null> {
  const { entry } = await getEmDashEntry("pages", slug);
  if (!entry) return null;
  const seo = fetchNativeSeo("pages", entry.id);
  return { data: entry.data as PageData, seo };
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

/**
 * Load all published adornments from ec_adornments as a name→AdornmentBlock map.
 * Used by Media.astro to resolve _adornmentName references at render time.
 * Synchronous SQLite read — fast (~1ms for small library).
 */
export function fetchAdornmentLibrary(): Map<string, AdornmentBlock> {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    type Row = {
      name: string;
      file: string | null;
      width: string | null;
      height: string | null;
      padding: string | null;
      margin: string | null;
      top: string | null;
      right: string | null;
      bottom: string | null;
      left: string | null;
      rotation: number | null;
      border: string | null;
      filter: string | null;
    };
    const rows = db
      .prepare<[], Row>(
        `SELECT name, file, width, height, padding, margin,
                top, "right", bottom, "left", rotation, border, filter
         FROM ec_adornments
         WHERE status = 'published' AND deleted_at IS NULL`
      )
      .all();
    db.close();
    const map = new Map<string, AdornmentBlock>();
    for (const row of rows) {
      const file: MediaFile = row.file
        ? (JSON.parse(row.file) as MediaFile)
        : { url: "", alt: null };
      map.set(row.name, {
        file,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        padding: row.padding ?? undefined,
        margin: row.margin ?? undefined,
        top: row.top ?? undefined,
        right: row.right ?? undefined,
        bottom: row.bottom ?? undefined,
        left: row.left ?? undefined,
        rotation: row.rotation ?? undefined,
        border: row.border ?? undefined,
        filter: row.filter ?? undefined,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}
