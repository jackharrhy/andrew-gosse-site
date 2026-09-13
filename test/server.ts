import { mkdtempSync, cpSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import bcrypt from "bcryptjs";

import { seedFixture } from "./seed-fixture.ts";

mkdirSync(resolve("tmp"), { recursive: true });
const target = mkdtempSync(resolve("tmp/e2e-"));
if (process.env.E2E_FIXTURE_DIR) {
  const reference = new DatabaseSync(
    resolve(process.env.E2E_FIXTURE_DIR, "tea.db"),
    { readOnly: true },
  );
  await backup(reference, join(target, "tea.db"));
  reference.close();
  cpSync(
    resolve(process.env.E2E_FIXTURE_DIR, "uploads"),
    join(target, "uploads"),
    { recursive: true },
  );
} else await seedFixture(target);
const sqlite = new DatabaseSync(join(target, "tea.db"));
sqlite
  .prepare("INSERT INTO users (email,password_hash) VALUES (?,?)")
  .run(
    "browser-test@example.test",
    await bcrypt.hash("test-only-browser-password", 4),
  );
sqlite.close();
process.env.TEA_DATA_DIR = target;
process.env.PORT = "4332";
process.env.HOST = "127.0.0.1";
await import("../server.ts");
