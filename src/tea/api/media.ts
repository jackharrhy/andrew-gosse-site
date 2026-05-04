import { ulid } from "ulid";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";
import { getDb } from "../db/client.js";

const UPLOADS_DIR = join(process.cwd(), "data", "uploads");

interface MediaRow {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  path: string;
  alt: string | null;
  created_at: string;
}

interface MediaItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
  alt: string | null;
  created_at: string;
}

function rowToItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    filename: row.filename,
    mime_type: row.mime_type,
    size: row.size,
    url: `/tea/api/media/file/${row.id}`,
    alt: row.alt,
    created_at: row.created_at,
  };
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function listMedia(): Response {
  const db = getDb();
  const rows = db.prepare<[], MediaRow>("SELECT * FROM media ORDER BY created_at DESC").all();
  return json({ items: rows.map(rowToItem) });
}

export async function uploadMedia(request: Request): Promise<Response> {
  const formData = await request.formData().catch(() => null);
  if (!formData) return json({ error: "Expected multipart form-data" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) return json({ error: "Missing file" }, { status: 400 });
  const alt = typeof formData.get("alt") === "string" ? (formData.get("alt") as string) : null;

  mkdirSync(UPLOADS_DIR, { recursive: true });

  const id = ulid();
  const ext = extname(file.name) || "";
  const storedFilename = `${id}${ext}`;
  const storedPath = join(UPLOADS_DIR, storedFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(storedPath, buffer);

  const db = getDb();
  db.prepare<[string, string, string, number, string, string | null]>(
    "INSERT INTO media (id, filename, mime_type, size, path, alt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, file.name, file.type || "application/octet-stream", file.size, storedFilename, alt);

  const row = db.prepare<[string], MediaRow>("SELECT * FROM media WHERE id = ?").get(id)!;
  return json({ item: rowToItem(row) }, { status: 201 });
}

export async function updateMedia(id: string, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const db = getDb();
  const row = db.prepare<[string], MediaRow>("SELECT * FROM media WHERE id = ?").get(id);
  if (!row) return json({ error: "Not found" }, { status: 404 });

  if ("alt" in body) {
    const alt = typeof body.alt === "string" ? body.alt : null;
    db.prepare<[string | null, string]>("UPDATE media SET alt = ? WHERE id = ?").run(alt, id);
  }
  const updated = db.prepare<[string], MediaRow>("SELECT * FROM media WHERE id = ?").get(id)!;
  return json({ item: rowToItem(updated) });
}

export function deleteMedia(id: string): Response {
  const db = getDb();
  const row = db.prepare<[string], MediaRow>("SELECT * FROM media WHERE id = ?").get(id);
  if (!row) return new Response(null, { status: 404 });
  try {
    unlinkSync(join(UPLOADS_DIR, row.path));
  } catch {
    // file may already be missing; non-fatal
  }
  db.prepare<[string]>("DELETE FROM media WHERE id = ?").run(id);
  return new Response(null, { status: 204 });
}

export function serveMediaFile(id: string): Response {
  const db = getDb();
  const row = db.prepare<[string], MediaRow>("SELECT * FROM media WHERE id = ?").get(id);
  if (!row) return new Response("Not found", { status: 404 });

  const filePath = join(UPLOADS_DIR, row.path);
  let buffer: Buffer;
  try {
    buffer = readFileSync(filePath);
  } catch {
    return new Response("File missing", { status: 410 });
  }
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(row.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
