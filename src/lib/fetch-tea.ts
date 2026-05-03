// src/lib/fetch-tea.ts
// Public site read functions. Synchronous — direct better-sqlite3 reads.
import { getReadOnlyDb } from "../tea/db/client.js";
import type {
  Block,
  ResolvedAdornment,
  SidebarCategory,
  SidebarLink,
} from "../types/blocks.js";

export interface TeaSeo {
  title: string | null;
  description: string | null;
  image_url: string | null;
  no_index: boolean;
  canonical: string | null;
}

export interface TeaPage {
  id: string;
  slug: string;
  title: string;
  blocks: Block[];
  seo: TeaSeo;
}

export interface TeaPageSummary {
  slug: string;
  title: string;
}

export interface TeaHomepage {
  blocks: Block[];
  seo: TeaSeo;
}

export interface TeaSidebarItem {
  text: string;
  pageSlug: string;
}

export interface TeaSidebarCategory {
  categoryTitle: string | null;
  backgroundImageUrl: string | null;
  items: TeaSidebarItem[];
}

export interface TeaSidebar {
  topImageUrl: string | null;
  topImageAlt: string | null;
  categories: TeaSidebarCategory[];
  links: SidebarLink[];
}

export interface TeaSite {
  background_color: string;
}

/** Build the public URL for a media id. */
export function getMediaUrl(id: string | null): string | null {
  if (!id) return null;
  return `/tea/api/media/file/${id}`;
}

interface MediaRow {
  id: string;
  alt: string | null;
}

function getMediaAlt(id: string | null): string | null {
  if (!id) return null;
  const db = getReadOnlyDb();
  const row = db.prepare<[string], MediaRow>("SELECT id, alt FROM media WHERE id = ?").get(id);
  return row?.alt ?? null;
}

interface PageRow {
  id: string;
  slug: string;
  title: string;
  blocks: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_id: string | null;
  seo_no_index: number;
  seo_canonical: string | null;
}

function rowToPage(row: PageRow): TeaPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    blocks: JSON.parse(row.blocks) as Block[],
    seo: {
      title: row.seo_title,
      description: row.seo_description,
      image_url: getMediaUrl(row.seo_image_id),
      no_index: row.seo_no_index === 1,
      canonical: row.seo_canonical,
    },
  };
}

export function getPage(slug: string): TeaPage | null {
  const db = getReadOnlyDb();
  const row = db
    .prepare<[string], PageRow>(
      "SELECT id, slug, title, blocks, seo_title, seo_description, seo_image_id, seo_no_index, seo_canonical FROM pages WHERE slug = ?"
    )
    .get(slug);
  return row ? rowToPage(row) : null;
}

export function getPages(): TeaPageSummary[] {
  const db = getReadOnlyDb();
  const rows = db
    .prepare<[], { slug: string; title: string }>(
      "SELECT slug, title FROM pages ORDER BY slug"
    )
    .all();
  return rows;
}

interface HomepageRow {
  blocks: string;
}

export function getHomepage(): TeaHomepage {
  const db = getReadOnlyDb();
  const row = db
    .prepare<[], HomepageRow>("SELECT blocks FROM homepage WHERE id = 'homepage'")
    .get();
  return {
    blocks: row ? (JSON.parse(row.blocks) as Block[]) : [],
    seo: { title: null, description: null, image_url: null, no_index: false, canonical: null },
  };
}

interface SidebarRow {
  top_image_id: string | null;
  categories: string;
  links: string;
}

export function getSidebar(): TeaSidebar {
  const db = getReadOnlyDb();
  const row = db
    .prepare<[], SidebarRow>(
      "SELECT top_image_id, categories, links FROM sidebar WHERE id = 'sidebar'"
    )
    .get();
  const rawCategories = row ? (JSON.parse(row.categories) as SidebarCategory[]) : [];
  const categories: TeaSidebarCategory[] = rawCategories.map((c) => ({
    categoryTitle: c.categoryTitle ?? null,
    backgroundImageUrl: getMediaUrl(c.backgroundImageId ?? null),
    items: c.items,
  }));
  return {
    topImageUrl: getMediaUrl(row?.top_image_id ?? null),
    topImageAlt: getMediaAlt(row?.top_image_id ?? null),
    categories,
    links: row ? (JSON.parse(row.links) as SidebarLink[]) : [],
  };
}

export function getSite(): TeaSite {
  const db = getReadOnlyDb();
  const row = db
    .prepare<[], { background_color: string }>(
      "SELECT background_color FROM site WHERE id = 'site'"
    )
    .get();
  return { background_color: row?.background_color ?? "#ffffff" };
}

interface AdornmentRow {
  name: string;
  media_id: string | null;
  css: string;
  alt: string | null;
}

/** Returns map of adornment name → resolved data. Used by Media block renderer. */
export function getAdornmentLibrary(): Map<string, ResolvedAdornment> {
  const db = getReadOnlyDb();
  const rows = db
    .prepare<[], AdornmentRow>(
      `SELECT a.name, a.media_id, a.css, m.alt
       FROM adornments a
       LEFT JOIN media m ON m.id = a.media_id`
    )
    .all();
  const map = new Map<string, ResolvedAdornment>();
  for (const row of rows) {
    map.set(row.name, {
      name: row.name,
      url: getMediaUrl(row.media_id) ?? "",
      alt: row.alt,
      css: JSON.parse(row.css) as ResolvedAdornment["css"],
    });
  }
  return map;
}
