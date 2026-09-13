import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

function inventory(dir: string) {
  const db = new DatabaseSync(join(dir, "tea.db"), { readOnly: true });
  const tables = [
    "users",
    "sessions",
    "media",
    "adornments",
    "site",
    "sidebar",
    "homepage",
    "pages",
  ];
  const rows = Object.fromEntries(
    tables.map((t) => [t, db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]),
  );
  const files = readdirSync(join(dir, "uploads"))
    .sort()
    .map((path) => {
      const bytes = readFileSync(join(dir, "uploads", path));
      return {
        path,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
  db.close();
  return { rows, files };
}
if (!process.argv[2])
  throw new Error("Usage: npm run tea:parity -- <source-dir> [target-dir]");
const sourceDir = resolve(process.argv[2]);
const targetDir = resolve(process.argv[3] ?? "data");
if (sourceDir === targetDir) throw new Error("Source and target must differ");
const source = inventory(sourceDir);
const target = inventory(targetDir);
if (JSON.stringify(target) !== JSON.stringify(source)) {
  console.error(
    "Parity failed: database rows or uploaded bytes differ. No row contents are printed because they may contain credentials or sessions.",
  );
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      parity: "exact",
      rows: Object.fromEntries(
        Object.entries(source.rows).map(([k, v]) => [k, v.length]),
      ),
      files: source.files.length,
      bytes: source.files.reduce((n, f) => n + f.size, 0),
    },
    null,
    2,
  ),
);
