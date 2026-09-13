import { it } from "remix/test";
import * as assert from "remix/assert";
import { openDatabase } from "./database.ts";
import { ContentStore } from "./content.ts";

it("preserves unknown block properties and rejects stale saves", async () => {
  const { sqlite } = await openDatabase(":memory:");
  const blocks = [
    {
      id: "b",
      type: "markdown",
      props: { body: "<span>hello</span>", future: "keep" },
      content: [],
      children: [],
      custom: { a: 1 },
    },
  ];
  sqlite
    .prepare("INSERT INTO pages (id,slug,title,blocks) VALUES (?,?,?,?)")
    .run("p", "gallery", "Gallery", JSON.stringify(blocks));
  const store = new ContentStore(sqlite);
  const before = store.page("gallery")!;
  assert.equal(
    store.savePage(
      "gallery",
      { ...before, title: "New title" },
      before.revision,
    ).ok,
    true,
  );
  assert.deepEqual(store.page("gallery")!.blocks, blocks);
  assert.equal(store.savePage("gallery", before, before.revision).ok, false);
  assert.equal(store.page("gallery")!.title, "New title");
  sqlite.close();
});
