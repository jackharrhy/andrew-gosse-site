import { cpSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../app/data/database.ts";
import type { ContentBlock } from "../app/ui/public/content-types.ts";

// No customer data or credentials are required by CI. The optional real-content
// suite uses a separate SQLite backup, never the working database.
export async function seedFixture(directory: string) {
  const { sqlite } = await openDatabase(join(directory, "tea.db"));
  try {
    mkdirSync(join(directory, "uploads"), { recursive: true });
    cpSync("public/favicon.png", join(directory, "uploads", "sample.png"));
    for (const [id, name] of [
      ["photo", "Sample photo"],
      ["tape", "Sample tape"],
    ])
      sqlite
        .prepare(
          "INSERT INTO media(id,filename,mime_type,size,path,alt) VALUES(?,?,?,?,?,?)",
        )
        .run(
          id,
          name,
          "image/png",
          statSync("public/favicon.png").size,
          "sample.png",
          name,
        );
    sqlite
      .prepare("INSERT INTO adornments(id,name,media_id,css) VALUES(?,?,?,?)")
      .run(
        "tape-art",
        "tape top left 1",
        "tape",
        JSON.stringify({ width: "25%", left: "0%", top: "0%" }),
      );
    function blocks(title: string): ContentBlock[] {
      return [
        {
          id: "heading",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: title }],
        },
        {
          id: "image",
          type: "media",
          props: {
            mediaId: "photo",
            alt: "Sample photo",
            width: "100%",
            adornments: '[{"adornmentName":"tape top left 1"}]',
          },
        },
        {
          id: "text",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "A sample page for editing tests." }],
        },
      ];
    }
    for (const [slug, title] of [
      ["about", "About"],
      ["gallery", "Gallery"],
      ["contact", "Contact"],
    ])
      sqlite
        .prepare("INSERT INTO pages(id,slug,title,blocks) VALUES(?,?,?,?)")
        .run(slug, slug, title, JSON.stringify(blocks(title)));
    sqlite
      .prepare("UPDATE homepage SET blocks=?")
      .run(JSON.stringify(blocks("Noticeboard")));
    sqlite.prepare("UPDATE sidebar SET top_image_id=?,categories=?").run(
      "photo",
      JSON.stringify([
        {
          categoryTitle: "Pages",
          items: [
            { text: "About", pageSlug: "about" },
            { text: "Gallery", pageSlug: "gallery" },
          ],
        },
      ]),
    );
  } finally {
    sqlite.close();
  }
}
