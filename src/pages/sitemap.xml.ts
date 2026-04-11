/**
 * Custom sitemap — overrides EmDash's default sitemap.
 * Uses correct URL patterns: / for homepage, /{slug} for pages.
 *
 * EmDash exposes its Kysely DB instance on locals.emdash.db.
 * We query ec_pages directly to get all published page slugs.
 */
import type { APIRoute } from "astro";

type KyselyLike = {
  selectFrom: (table: string) => {
    select: (cols: string[]) => {
      where: (col: string, op: string, val: string | null | number) => {
        whereNot?: unknown;
        execute: () => Promise<Array<{ slug: string; updated_at?: string }>>
      }
    }
  }
};

export const prerender = false;

export const GET: APIRoute = async ({ site, locals }) => {
  const base = (site?.origin ?? "https://andrewgosse.com").replace(/\/$/, "");

  const slugs: Array<{ slug: string; lastmod?: string }> = [];

  try {
    const emdash = (locals as { emdash?: { db?: KyselyLike } }).emdash;
    const db = emdash?.db;

    if (db) {
      const rows = await db
        .selectFrom("ec_pages")
        .select(["slug"])
        .where("slug", "is not", null)
        .execute();

      for (const row of rows) {
        if (row.slug) {
          slugs.push({ slug: row.slug });
        }
      }
    }
  } catch {
    // Return best-effort sitemap
  }

  // Filter out internal EmDash collection slugs
  const exclude = new Set(["homepage", "sidebar", "site"]);
  const pages = slugs.filter((p) => !exclude.has(p.slug));

  const urls = [
    `  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...pages.map(
      ({ slug }) =>
        `  <url><loc>${base}/${slug}</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    ),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
