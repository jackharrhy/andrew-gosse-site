import { DatabaseSync, backup } from "node:sqlite";
import { cp, mkdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

if (!process.argv[2])
  throw new Error("Usage: node scripts/copy-fixture.ts <source-dir> [target-dir]");
const source = resolve(process.argv[2]);
const target = resolve(process.argv[3] ?? "data");
if (source === target) throw new Error("Source and target must differ");
if (await stat(target).catch(() => null))
  throw new Error("Target already exists; refusing to overwrite it");
await mkdir(target, { recursive: true });
const db = new DatabaseSync(join(source, "tea.db"), { readOnly: true });
await backup(db, join(target, "tea.db"));
db.close();
await cp(join(source, "uploads"), join(target, "uploads"), {
  recursive: true,
  errorOnExist: true,
  force: false,
});
console.log("Independent SQLite snapshot and uploads copied to", target);
