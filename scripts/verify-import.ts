import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { deepStrictEqual } from "node:assert";

// Imports generate fresh IDs. Compare the content and the bytes each reference points to.
function content(directory: string) {
  const db = new DatabaseSync(join(directory, "tea.db"), { readOnly: true });
  const media = db.prepare("SELECT * FROM media").all();
  const ids = new Map(
    media.map((m) => [
      m.id,
      createHash("sha256")
        .update(readFileSync(join(directory, "uploads", String(m.path))))
        .digest("hex"),
    ]),
  );
  function normalize(value: any): any {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
          .map(([k, v]) => [k, normalize(v)]),
      );
    if (typeof value === "string") {
      if (ids.has(value)) return ids.get(value);
      if (value.startsWith("[") || value.startsWith("{")) {
        try {
          return normalize(JSON.parse(value));
        } catch {}
      }
      for (const [id, hash] of ids)
        value = value.replaceAll(String(id), String(hash));
    }
    return value;
  }
  const result = {
    pages: normalize(db.prepare("SELECT * FROM pages ORDER BY slug").all()),
    homepage: normalize(db.prepare("SELECT * FROM homepage").all()),
    sidebar: normalize(db.prepare("SELECT * FROM sidebar").all()),
    site: normalize(db.prepare("SELECT * FROM site").all()),
    adornments: normalize(
      db.prepare("SELECT * FROM adornments ORDER BY name").all(),
    ),
    media: media
      .map((m) => ({
        filename: m.filename,
        mime: m.mime_type,
        size: m.size,
        alt: m.alt,
        hash: ids.get(m.id),
      }))
      .sort((a, b) => String(a.hash).localeCompare(String(b.hash))),
  };
  db.close();
  return result;
}
const baseline = resolve(process.argv[2] ?? "data"),
  imported = process.argv[3];
if (!imported)
  throw new Error(
    "Usage: npm run tea:verify-import -- BASELINE_DATA IMPORTED_DATA",
  );
deepStrictEqual(content(resolve(imported)), content(baseline));
console.log(
  "Imported pages, blocks, sidebar, site, adornments, and media bytes match the reference.",
);
