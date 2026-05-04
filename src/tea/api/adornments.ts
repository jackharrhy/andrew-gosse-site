import { ulid } from "ulid";
import { getDb } from "../db/client.js";

interface AdornmentRow {
  id: string;
  name: string;
  media_id: string | null;
  css: string;
  created_at: string;
}

interface AdornmentItem {
  id: string;
  name: string;
  media_id: string | null;
  css: Record<string, unknown>;
  created_at: string;
}

function rowToItem(row: AdornmentRow): AdornmentItem {
  return {
    id: row.id,
    name: row.name,
    media_id: row.media_id,
    css: JSON.parse(row.css),
    created_at: row.created_at,
  };
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function listAdornments(): Response {
  const db = getDb();
  const rows = db.prepare<[], AdornmentRow>("SELECT * FROM adornments ORDER BY name").all();
  return json({ items: rows.map(rowToItem) });
}

export async function createAdornment(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return json({ error: "name is required" }, { status: 400 });

  const db = getDb();
  const exists = db.prepare<[string], { id: string }>("SELECT id FROM adornments WHERE name = ?").get(name);
  if (exists) return json({ error: "Name already exists" }, { status: 409 });

  const id = ulid();
  const mediaId = typeof body.media_id === "string" ? body.media_id : null;
  const css = JSON.stringify(body.css ?? {});

  db.prepare<[string, string, string | null, string]>(
    "INSERT INTO adornments (id, name, media_id, css) VALUES (?, ?, ?, ?)"
  ).run(id, name, mediaId, css);

  const row = db.prepare<[string], AdornmentRow>("SELECT * FROM adornments WHERE id = ?").get(id)!;
  return json({ item: rowToItem(row) }, { status: 201 });
}

export async function updateAdornment(id: string, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb();
  const row = db.prepare<[string], AdornmentRow>("SELECT * FROM adornments WHERE id = ?").get(id);
  if (!row) return json({ error: "Not found" }, { status: 404 });

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (typeof body.name === "string") {
    updates.push("name = ?");
    values.push(body.name);
  }
  if ("media_id" in body) {
    updates.push("media_id = ?");
    values.push(typeof body.media_id === "string" ? body.media_id : null);
  }
  if (body.css && typeof body.css === "object") {
    updates.push("css = ?");
    values.push(JSON.stringify(body.css));
  }
  if (updates.length === 0) return json({ item: rowToItem(row) });

  values.push(id);
  db.prepare(`UPDATE adornments SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare<[string], AdornmentRow>("SELECT * FROM adornments WHERE id = ?").get(id)!;
  return json({ item: rowToItem(updated) });
}

export function deleteAdornment(id: string): Response {
  const db = getDb();
  const result = db.prepare<[string]>("DELETE FROM adornments WHERE id = ?").run(id);
  if (result.changes === 0) return new Response(null, { status: 404 });
  return new Response(null, { status: 204 });
}
