// astro-site/src/lib/fetch-emdash.ts
import { getEmDashCollection, getEmDashEntry } from "emdash";
import type { Block, Seo, SidebarCategory, SidebarLink } from "../types/emdash";

export interface HomepageData {
  seo?: Seo | null;
  blocks?: Block[];
}

export interface PageData {
  page_slug: string;
  seo?: Seo | null;
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
  // pages use page_slug field, but EmDash routes by the system `slug` column.
  // The migration script seeds pages with slug = the page's slug value.
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
