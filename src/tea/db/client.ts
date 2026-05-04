import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { applySchema } from "./schema.js";

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "tea.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  applySchema(_db);
  return _db;
}

export function getReadOnlyDb(): Database.Database {
  return getDb();
}
