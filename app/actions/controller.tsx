import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../routes.ts";
import { assets } from "../assets.ts";
import { contentContext } from "../middleware/context.ts";
import { PublicPage } from "./public-page.tsx";
import { serveMedia } from "./media.ts";
import { sitemapXml } from "./public-seo.ts";

export default createController(routes, {
  actions: {
    sitemap(c) {
      const store = c.get(contentContext);
      return new Response(
        sitemapXml([store.homepage(), ...store.pages()], store.site()),
        {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        },
      );
    },
    robots(c) {
      const site = c.get(contentContext).site();
      const sitemap = new URL(routes.sitemap.href(), site.canonical_origin)
        .href;
      return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    },
    async assets(c) {
      return (
        (await assets.fetch(c.request)) ??
        new Response("Not found", { status: 404 })
      );
    },
    home(c) {
      const store = c.get(contentContext);
      return c.render(
        <PublicPage
          page={store.homepage()}
          store={store}
          path="/"
          preview={c.url.searchParams.has("preview")}
        />,
      );
    },
    page(c) {
      const store = c.get(contentContext),
        slug = c.params.slug.replace(/\/+$/, ""),
        page = store.page(slug);
      if (page && slug !== c.params.slug)
        return redirect(routes.page.href({ slug }) + c.url.search, 301);
      return c.render(
        <PublicPage
          page={page}
          store={store}
          path={c.url.pathname}
          preview={c.url.searchParams.has("preview")}
        />,
        { status: page ? 200 : 404 },
      );
    },
    file(c) {
      return serveMedia(c.request, c.params.id, c.get(contentContext));
    },
    health(c) {
      c.get(contentContext).sqlite.prepare("SELECT 1").get();
      return Response.json({ ok: true, app: "TeaCMS", framework: "Remix 3" });
    },
  },
});
