import { createController } from "remix/router";
import { routes } from "../routes.ts";
import { assets } from "../assets.ts";
import { contentContext } from "../middleware/context.ts";
import { PublicPage } from "./public-page.tsx";
import { serveMedia } from "./media.ts";

export default createController(routes, {
  actions: {
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
        page = store.page(c.params.slug);
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
