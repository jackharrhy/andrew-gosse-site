import { assets } from "../app/assets.ts";
const entries = [
  "app/actions/public/entry.ts",
  "app/actions/admin/public/editor.tsx",
  "app/actions/admin/public/media-library.tsx",
  "app/actions/admin/public/navigation-editor.tsx",
  "app/actions/admin/public/navigation-toggle.tsx",
  "app/actions/admin/public/adornment-library.tsx",
  "app/actions/admin/public/site-settings.tsx",
];
try {
  const hrefs = new Set<string>();
  for (const entry of entries) {
    hrefs.add(await assets.getHref(entry));
    for (const href of await assets.getPreloads(entry)) hrefs.add(href);
  }
  for (const href of hrefs) {
    const response = await assets.fetch(
      new Request(new URL(href, "http://localhost")),
    );
    if (!response?.ok) throw new Error(`Browser asset failed: ${href}`);
    await response.arrayBuffer();
  }
  console.log(
    `Verified ${hrefs.size} browser modules. Remix serves TypeScript directly; no server bundle is required.`,
  );
} finally {
  await assets.close();
}
