import { getDb } from "../db/client.js";

interface SidebarRow {
  id: string;
  top_image_id: string | null;
  categories: string;
  links: string;
  updated_at: string;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function getSidebar(): Response {
  const db = getDb();
  const row = db.prepare<[], SidebarRow>("SELECT * FROM sidebar WHERE id = 'sidebar'").get();
  if (!row) return json({ error: "Not found" }, { status: 404 });
  return json({
    item: {
      top_image_id: row.top_image_id,
      categories: JSON.parse(row.categories),
      links: JSON.parse(row.links),
      updated_at: row.updated_at,
    },
  });
}

export async function updateSidebar(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb();
  const updates: string[] = [];
  const values: (string | null)[] = [];

  if ("top_image_id" in body) {
    updates.push("top_image_id = ?");
    values.push(typeof body.top_image_id === "string" ? body.top_image_id : null);
  }
  if (Array.isArray(body.categories)) {
    updates.push("categories = ?");
    values.push(JSON.stringify(body.categories));
  }
  if (Array.isArray(body.links)) {
    updates.push("links = ?");
    values.push(JSON.stringify(body.links));
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE sidebar SET ${updates.join(", ")} WHERE id = 'sidebar'`).run(...values);
  }
  return getSidebar();
}
