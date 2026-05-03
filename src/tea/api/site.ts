import { getDb } from "../db/client.js";

interface SiteRow {
  id: string;
  background_color: string;
  updated_at: string;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function getSite(): Response {
  const db = getDb();
  const row = db.prepare<[], SiteRow>("SELECT * FROM site WHERE id = 'site'").get();
  if (!row) return json({ error: "Not found" }, { status: 404 });
  return json({ item: row });
}

export async function updateSite(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb();
  if (typeof body.background_color === "string") {
    db.prepare<[string]>("UPDATE site SET background_color = ?, updated_at = datetime('now') WHERE id = 'site'")
      .run(body.background_color);
  }
  return getSite();
}
