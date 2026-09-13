import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { ContentStore } from "../app/data/content.ts";
import { parsePage } from "../app/actions/input.ts";
const origin = process.argv[2] ?? "http://127.0.0.1:4331";
const sqlite = new DatabaseSync(
  resolve(process.env.TEA_DATA_DIR ?? "data", "tea.db"),
  { readOnly: true },
);
const store = new ContentStore(sqlite);
const pages = [store.homepage(), ...store.pages()];
for (const page of pages)
  if (!parsePage(page))
    throw new Error(
      `Stored page fails editor validation: ${page.slug || "homepage"}`,
    );
const paths = [
  "/",
  ...store.pages().map((p) => "/" + p.slug),
  ...store.media().map((m) => "/tea/api/media/file/" + m.id),
];
for (const path of paths) {
  const response = await fetch(new URL(path, origin));
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  await response.arrayBuffer();
}
const protectedRoute = await fetch(new URL("/tea/admin", origin), {
  redirect: "manual",
});
if (protectedRoute.status !== 303)
  throw new Error("Anonymous admin request was not redirected");
sqlite.close();
console.log(
  `Verified ${paths.length} public routes/media and protected admin access. All ${pages.length} stored documents pass editor validation.`,
);
