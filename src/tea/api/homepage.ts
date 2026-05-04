import { getDb } from "../db/client.js";

interface HomepageRow {
  id: string;
  blocks: string;
  updated_at: string;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function getHomepage(): Response {
  const db = getDb();
  const row = db.prepare<[], HomepageRow>("SELECT * FROM homepage WHERE id = 'homepage'").get();
  if (!row) return json({ error: "Not found" }, { status: 404 });
  return json({ item: { blocks: JSON.parse(row.blocks), updated_at: row.updated_at } });
}

export async function updateHomepage(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb();
  if (Array.isArray(body.blocks) || typeof body.blocks === "object") {
    db.prepare<[string]>("UPDATE homepage SET blocks = ?, updated_at = datetime('now') WHERE id = 'homepage'")
      .run(JSON.stringify(body.blocks));
  }
  const row = db.prepare<[], HomepageRow>("SELECT * FROM homepage WHERE id = 'homepage'").get()!;
  return json({ item: { blocks: JSON.parse(row.blocks), updated_at: row.updated_at } });
}
