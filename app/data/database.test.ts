import { it } from "remix/test";
import * as assert from "remix/assert";
import { openDatabase } from "./database.ts";

it("initializes an empty database and can replay its migration baseline", async () => {
  const { db, sqlite } = await openDatabase(":memory:");
  assert.equal(
    sqlite.prepare("SELECT count(*) AS n FROM homepage").get()?.n,
    1,
  );
  sqlite
    .prepare(
      "INSERT INTO pages (id,slug,title,blocks) VALUES ('one','gallery','Gallery','[]')",
    )
    .run();
  await db.migrate(
    await (
      await import("remix/data-table/migrations/node")
    ).loadMigrations("db/migrations"),
  );
  assert.equal(
    sqlite.prepare("SELECT title FROM pages").get()?.title,
    "Gallery",
  );
  sqlite.close();
});
