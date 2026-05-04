import { ulid } from "ulid";
import { getDb } from "../db/client.js";

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
  created_at: string;
  updated_at: string;
}

interface PageItem {
  id: string;
  slug: string;
  title: string;
  blocks: unknown;
  seo: {
    title: string | null;
    description: string | null;
    image_id: string | null;
    no_index: boolean;
    canonical: string | null;
  };
  created_at: string;
  updated_at: string;
}

function rowToItem(row: PageRow): PageItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    blocks: JSON.parse(row.blocks),
    seo: {
      title: row.seo_title,
      description: row.seo_description,
      image_id: row.seo_image_id,
      no_index: row.seo_no_index === 1,
      canonical: row.seo_canonical,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function listPages(): Response {
  const db = getDb();
  const rows = db
    .prepare<[], PageRow>("SELECT * FROM pages ORDER BY slug")
    .all();
  return json({ items: rows.map(rowToItem) });
}

export function getPageBySlug(slug: string): Response {
  const db = getDb();
  const row = db.prepare<[string], PageRow>("SELECT * FROM pages WHERE slug = ?").get(slug);
  if (!row) return json({ error: "Not found" }, { status: 404 });
  return json({ item: rowToItem(row) });
}

export async function createPage(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!slug || !title) return json({ error: "slug and title are required" }, { status: 400 });

  const db = getDb();
  const exists = db.prepare<[string], { id: string }>("SELECT id FROM pages WHERE slug = ?").get(slug);
  if (exists) return json({ error: "Slug already exists" }, { status: 409 });

  const id = ulid();
  const blocks = JSON.stringify(body.blocks ?? []);
  const seo = (body.seo ?? {}) as Record<string, unknown>;

  db.prepare<[string, string, string, string, string | null, string | null, string | null, number, string | null]>(
    `INSERT INTO pages (id, slug, title, blocks, seo_title, seo_description, seo_image_id, seo_no_index, seo_canonical)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    slug,
    title,
    blocks,
    typeof seo.title === "string" ? seo.title : null,
    typeof seo.description === "string" ? seo.description : null,
    typeof seo.image_id === "string" ? seo.image_id : null,
    seo.no_index === true ? 1 : 0,
    typeof seo.canonical === "string" ? seo.canonical : null
  );

  const row = db.prepare<[string], PageRow>("SELECT * FROM pages WHERE id = ?").get(id)!;
  return json({ item: rowToItem(row) }, { status: 201 });
}

export async function updatePage(slug: string, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb();
  const row = db.prepare<[string], PageRow>("SELECT * FROM pages WHERE slug = ?").get(slug);
  if (!row) return json({ error: "Not found" }, { status: 404 });

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (typeof body.title === "string") {
    updates.push("title = ?");
    values.push(body.title);
  }
  if (Array.isArray(body.blocks) || typeof body.blocks === "object") {
    updates.push("blocks = ?");
    values.push(JSON.stringify(body.blocks));
  }
  if (body.seo && typeof body.seo === "object") {
    const seo = body.seo as Record<string, unknown>;
    if ("title" in seo) {
      updates.push("seo_title = ?");
      values.push(typeof seo.title === "string" ? seo.title : null);
    }
    if ("description" in seo) {
      updates.push("seo_description = ?");
      values.push(typeof seo.description === "string" ? seo.description : null);
    }
    if ("image_id" in seo) {
      updates.push("seo_image_id = ?");
      values.push(typeof seo.image_id === "string" ? seo.image_id : null);
    }
    if ("no_index" in seo) {
      updates.push("seo_no_index = ?");
      values.push(seo.no_index === true ? 1 : 0);
    }
    if ("canonical" in seo) {
      updates.push("seo_canonical = ?");
      values.push(typeof seo.canonical === "string" ? seo.canonical : null);
    }
  }

  if (updates.length === 0) return json({ item: rowToItem(row) });

  updates.push("updated_at = datetime('now')");
  values.push(slug);
  db.prepare(`UPDATE pages SET ${updates.join(", ")} WHERE slug = ?`).run(...values);

  const updated = db.prepare<[string], PageRow>("SELECT * FROM pages WHERE slug = ?").get(slug)!;
  return json({ item: rowToItem(updated) });
}

export function deletePage(slug: string): Response {
  const db = getDb();
  const result = db.prepare<[string]>("DELETE FROM pages WHERE slug = ?").run(slug);
  if (result.changes === 0) return json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
