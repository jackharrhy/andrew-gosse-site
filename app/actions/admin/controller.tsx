import * as s from "remix/data-schema";
import { sidebarSchema, siteSchema, adornmentSchema } from "./input.ts";
import { saveAdornment, deleteAdornment } from "../../data/adornments.ts";
import type { AppContext } from "../../router.ts";
import { blockReferences } from "../../ui/public/block-references.ts";
import {
  mediaFolders,
  saveFolder,
  deleteFolder,
  saveMediaDetails,
} from "../../data/media-folders.ts";
import { createController } from "remix/router";
import { routes } from "../../routes.ts";
import { contentContext, requireEditor } from "../../middleware/context.ts";
import { readInput, parsePage, invalid, saved, validSlug } from "../input.ts";
import { uploadMedia, deleteMedia } from "../media.ts";
import { PublicPage } from "../public-page.tsx";
import { Overview } from "./overview.tsx";
import { Pages } from "./pages.tsx";
import { AdminLayout } from "./layout.tsx";
import { Editor } from "./public/editor.tsx";
import { MediaLibrary } from "./public/media-library.tsx";
import { NavigationEditor } from "./public/navigation-editor.tsx";
import { AdornmentLibrary } from "./public/adornment-library.tsx";
import { SiteSettings } from "./public/site-settings.tsx";
import {
  SearchAppearance,
  searchAppearanceRows,
} from "./search-appearance.tsx";
import type { ContentStore } from "../../data/content.ts";
import type { ContentBlock } from "../../ui/public/content-types.ts";

function editor(context: AppContext, slug: string) {
  const store: ContentStore = context.get(contentContext),
    page = store.editorPage(slug);
  if (!page) return new Response("Page not found", { status: 404 });
  return context.render(
    <AdminLayout
      title={slug ? "Page editor" : "Homepage"}
      path={slug ? "/tea/admin/pages" : "/tea/admin/homepage"}
      wide
      editor
    >
      <Editor
        page={page}
        searchOpen={context.url.searchParams.get("section") === "seo"}
        media={store.media()}
        adornments={store.adornments()}
      />
    </AdminLayout>,
  );
}
function referencesValid(blocks: ContentBlock[], store: ContentStore): boolean {
  const refs = blockReferences(blocks);
  const names = new Set(store.adornments().map((a) => a.name));
  return (
    [...refs.media].every((id) => !!store.mediaItem(id)) &&
    [...refs.adornments].every((name) => names.has(name))
  );
}
async function savePage(context: AppContext, slug: string) {
  const data = parsePage(await readInput(context.request)),
    store: ContentStore = context.get(contentContext);
  if (!data)
    return invalid("Not saved. Check the title, blocks, and search fields.");
  if (
    !referencesValid(data.blocks, store) ||
    (data.seo.image_id && !store.mediaItem(data.seo.image_id))
  )
    return invalid(
      "An image or adornment is missing. Choose an existing item before saving.",
    );
  const result = store.saveDraft(slug, data, data.revision);
  return result.ok
    ? saved(
        context.request,
        slug ? "/tea/admin/pages/" + slug : "/tea/admin/homepage",
        result,
      )
    : invalid(result.error, result.status);
}
async function publishPage(context: AppContext, slug: string) {
  const input = await readInput(context.request),
    store: ContentStore = context.get(contentContext);
  const draft = store.editorPage(slug);
  if (
    !draft ||
    !referencesValid(draft.blocks, store) ||
    (draft.seo.image_id && !store.mediaItem(draft.seo.image_id))
  )
    return invalid("Check the draft images before publishing.");
  const result = store.publishDraft(
    slug,
    typeof input?.revision === "string" ? input.revision : "",
  );
  return result.ok
    ? Response.json(result)
    : invalid(result.error, result.status);
}
export default createController(routes.admin, {
  middleware: [requireEditor],
  actions: {
    index(c) {
      return c.render(<Overview store={c.get(contentContext)} />);
    },
    pages(c) {
      const query = c.url.searchParams.get("q") ?? "";
      const pages = c
        .get(contentContext)
        .editorPages()
        .filter((p) =>
          (p.title + " " + p.slug).toLowerCase().includes(query.toLowerCase()),
        );
      return c.render(<Pages pages={pages} query={query} />);
    },
    async createPage(c) {
      const data = await readInput(c.request);
      if (
        !data ||
        typeof data.title !== "string" ||
        !data.title.trim() ||
        data.title.length > 200 ||
        !validSlug(data.slug)
      )
        return invalid("Enter a title and a lowercase, hyphen-separated URL.");
      const result = c
        .get(contentContext)
        .createPage(data.title.trim(), data.slug);
      return result.ok
        ? saved(c.request, "/tea/admin/pages/" + data.slug, result)
        : invalid(result.error, result.status);
    },
    edit(c) {
      return editor(c, c.params.slug);
    },
    save(c) {
      return savePage(c, c.params.slug);
    },
    homepage(c) {
      return editor(c, "");
    },
    saveHomepage(c) {
      return savePage(c, "");
    },
    async publish(c) {
      return publishPage(c, c.params.slug);
    },
    async publishHomepage(c) {
      return publishPage(c, "");
    },
    async deletePage(c) {
      const data = await readInput(c.request);
      const result = c
        .get(contentContext)
        .deletePage(
          c.params.slug,
          typeof data?.revision === "string" ? data.revision : "",
        );
      return result.ok
        ? saved(c.request, routes.admin.pages.href())
        : invalid(result.error, result.status);
    },
    media(c) {
      const store = c.get(contentContext),
        media = store.media();
      return c.render(
        <AdminLayout title="Media library" path="/tea/admin/media" wide>
          <MediaLibrary
            media={media}
            folders={mediaFolders(store)}
            adornmentMedia={store
              .adornments()
              .map((a) => a.media_id)
              .filter((id): id is string => !!id)}
            references={store.mediaUsage()}
          />
        </AdminLayout>,
      );
    },
    upload(c) {
      return uploadMedia(c.request, c.get(contentContext));
    },
    async updateMedia(c) {
      const data = await readInput(c.request),
        store = c.get(contentContext);
      const result = saveMediaDetails(store, c.params.id, data);
      return result.ok ? Response.json(result) : invalid(result.error);
    },
    async saveFolder(c) {
      const result = saveFolder(
        c.get(contentContext),
        await readInput(c.request),
      );
      return result.ok ? Response.json(result) : invalid(result.error);
    },
    deleteFolder(c) {
      const result = deleteFolder(c.get(contentContext), c.params.id);
      return result.ok ? Response.json(result) : invalid(result.error, 409);
    },
    deleteMedia(c) {
      return deleteMedia(c.params.id, c.get(contentContext));
    },
    sidebar(c) {
      const store = c.get(contentContext);
      return c.render(
        <AdminLayout title="Navigation" path="/tea/admin/sidebar">
          <NavigationEditor
            sidebar={store.sidebar()}
            media={store.media()}
            pages={store.pages()}
          />
        </AdminLayout>,
      );
    },
    async saveSidebar(c) {
      const parsed = s.parseSafe(sidebarSchema, await readInput(c.request));
      if (!parsed.success)
        return invalid("Check navigation labels, links, and images.");
      const data = parsed.value,
        store = c.get(contentContext);
      if (
        (data.top_image_id && !store.mediaItem(data.top_image_id)) ||
        data.categories.some(
          (category) =>
            (category.backgroundImageId &&
              !store.mediaItem(category.backgroundImageId)) ||
            category.items.some((item) => !store.page(item.pageSlug)),
        )
      )
        return invalid("Choose existing pages and images.");
      const result = store.saveSidebar(data, data.revision);
      return result.ok
        ? Response.json(result)
        : invalid(result.error, result.status);
    },
    adornments(c) {
      const store = c.get(contentContext);
      return c.render(
        <AdminLayout title="Adornments" path="/tea/admin/adornments">
          <AdornmentLibrary
            adornments={store.adornments()}
            media={store.media()}
          />
        </AdminLayout>,
      );
    },
    async saveAdornment(c) {
      const parsed = s.parseSafe(adornmentSchema, await readInput(c.request));
      if (!parsed.success)
        return invalid(
          "Add a name, choose artwork, and check the layout values.",
        );
      const result = saveAdornment(c.get(contentContext), parsed.value);
      return result.ok
        ? Response.json(result)
        : invalid(result.error, result.status);
    },
    deleteAdornment(c) {
      const result = deleteAdornment(c.get(contentContext), c.params.id);
      return result.ok
        ? Response.json(result)
        : invalid(result.error, result.status);
    },
    site(c) {
      return c.render(
        <AdminLayout title="Site settings" path="/tea/admin/site">
          <SiteSettings site={c.get(contentContext).site()} />
        </AdminLayout>,
      );
    },
    async saveSite(c) {
      const parsed = s.parseSafe(siteSchema, await readInput(c.request));
      if (!parsed.success)
        return invalid(
          "Check the site name, background color, and website origin.",
        );
      const result = c
        .get(contentContext)
        .saveSite(parsed.value, parsed.value.revision);
      return result.ok
        ? Response.json(result)
        : invalid(result.error, result.status);
    },
    seo(c) {
      const store = c.get(contentContext);
      return c.render(
        <AdminLayout title="Search appearance" path="/tea/admin/seo">
          <SearchAppearance
            rows={searchAppearanceRows(store)}
            site={store.site()}
            filter={c.url.searchParams.get("filter") ?? "all"}
          />
        </AdminLayout>,
      );
    },
    async preview(c) {
      const input = await readInput(c.request),
        page = parsePage(input);
      if (!page) return invalid("Preview could not read this page.");
      return c.render(
        <PublicPage
          store={c.get(contentContext)}
          page={{
            ...page,
            id: "preview",
            slug: typeof input?.slug === "string" ? input.slug : "",
          }}
          path={"/" + (input?.slug ?? "")}
          preview
        />,
      );
    },
    history(c) {
      const rows = c
        .get(contentContext)
        .sqlite.prepare(
          "SELECT id,snapshot,created_at FROM content_history WHERE content_id=? AND kind IN ('page','homepage') ORDER BY id DESC LIMIT 30",
        )
        .all(c.params.id);
      return Response.json(rows);
    },
  },
});
