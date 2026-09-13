import { it } from "remix/test";
import * as assert from "remix/assert";
import bcrypt from "bcryptjs";
import { openDatabase } from "../data/database.ts";
import { createTeaRouter } from "../router.ts";
import { ContentStore } from "../data/content.ts";
import { routes } from "../routes.ts";
import { AuthStore } from "../data/auth.ts";

it("lists only published, indexable, self-canonical pages and advertises the sitemap", async () => {
  const database = await openDatabase(":memory:");
  try {
    const store = new ContentStore(database.sqlite);
    const site = store.site();
    store.saveSite(
      { ...site, canonical_origin: "https://portfolio.test" },
      site.revision,
    );
    for (const slug of ["live", "hidden", "duplicate", "external", "draft"]) {
      store.createPage(slug, slug);
      if (slug !== "draft")
        store.publishDraft(slug, store.editorPage(slug)!.revision);
    }
    for (const slug of ["hidden", "duplicate", "external"]) {
      const page = store.page(slug)!;
      store.savePage(
        slug,
        {
          ...page,
          seo: {
            ...page.seo,
            no_index: slug === "hidden",
            canonical:
              slug === "duplicate"
                ? "https://portfolio.test/live"
                : slug === "external"
                  ? "https://elsewhere.test/work"
                  : null,
          },
        },
        page.revision,
      );
    }
    const live = store.page("live")!;
    store.saveDraft(
      "live",
      { ...live, seo: { ...live.seo, no_index: true } },
      live.revision,
    );
    const router = createTeaRouter(database);
    const request = (path: string) =>
      router.fetch(new Request("http://untrusted-host.test" + path));
    const sitemap = await request(routes.sitemap.href());
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type")!, /application\/xml/);
    assert.equal(sitemap.headers.get("cache-control"), "no-cache");
    const xml = await sitemap.text();
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(
      xml,
      /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/,
    );
    assert.deepEqual(
      [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
      ["https://portfolio.test/", "https://portfolio.test/live"],
    );
    assert.equal(xml.includes("lastmod"), false);
    const robots = await request(routes.robots.href());
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get("content-type")!, /text\/plain/);
    assert.equal(
      await robots.text(),
      "User-agent: *\nAllow: /\n\nSitemap: https://portfolio.test/sitemap.xml\n",
    );

    store.publishDraft("live", store.editorPage("live")!.revision);
    store.publishDraft("draft", store.editorPage("draft")!.revision);
    const home = store.homepage();
    store.savePage(
      "",
      { ...home, seo: { ...home.seo, no_index: true } },
      home.revision,
    );
    const updated = await (await request(routes.sitemap.href())).text();
    assert.deepEqual(
      [...updated.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
      ["https://portfolio.test/draft"],
    );
    store.deletePage("draft", store.editorPage("draft")!.revision);
    assert.equal(
      (await (await request(routes.sitemap.href())).text()).includes("<loc>"),
      false,
    );
  } finally {
    database.sqlite.close();
  }
});

it("renders safe structured data from published SEO fields without inventing missing details", async () => {
  const database = await openDatabase(":memory:");
  try {
    const store = new ContentStore(database.sqlite);
    const site = store.site();
    store.saveSite(
      {
        ...site,
        site_name: "Composer & Artist",
        description: "Music and artwork.",
        canonical_origin: "https://portfolio.test",
      },
      site.revision,
    );
    store.createPage("Gallery", "gallery");
    store.publishDraft("gallery", store.editorPage("gallery")!.revision);
    const router = createTeaRouter(database);
    const html = async (path: string) =>
      (await router.fetch(new Request("http://localhost" + path))).text();
    const graph = (source: string) => {
      const scripts = [
        ...source.matchAll(
          /<script type="application\/ld\+json">(.*?)<\/script>/gs,
        ),
      ];
      assert.equal(scripts.length, 1);
      const data = JSON.parse(scripts[0][1]);
      assert.equal(data["@context"], "https://schema.org");
      return data["@graph"];
    };
    const [website, webpage] = graph(
      await html(routes.page.href({ slug: "gallery" })),
    );
    assert.deepEqual(website, {
      "@type": "WebSite",
      "@id": "https://portfolio.test/#website",
      url: "https://portfolio.test/",
      name: "Composer & Artist",
      description: "Music and artwork.",
      inLanguage: "en",
    });
    assert.deepEqual(webpage, {
      "@type": "WebPage",
      "@id": "https://portfolio.test/gallery#webpage",
      url: "https://portfolio.test/gallery",
      name: "Gallery | Composer & Artist",
      description: "Music and artwork.",
      isPartOf: { "@id": website["@id"] },
      inLanguage: "en",
    });

    const page = store.page("gallery")!;
    const description = '</script><script>alert("test")</script> & music';
    database.sqlite
      .prepare(
        "INSERT INTO media (id,filename,mime_type,size,path) VALUES (?,?,?,?,?)",
      )
      .run(
        "sharing-image",
        "sharing.png",
        "image/png",
        1,
        "uploads/sharing.png",
      );
    store.saveDraft(
      "gallery",
      {
        ...page,
        seo: {
          ...page.seo,
          title: "Selected work",
          description,
          image_id: "sharing-image",
          canonical: "https://portfolio.test/selected?one=1&two=2",
        },
      },
      page.revision,
    );
    assert.equal(graph(await html("/gallery"))[1].name, webpage.name);
    store.publishDraft("gallery", store.editorPage("gallery")!.revision);
    const published = await html("/gallery");
    const updated = graph(published)[1];
    assert.equal(updated.name, "Selected work | Composer & Artist");
    assert.equal(updated.description, description);
    assert.equal(updated.url, "https://portfolio.test/selected?one=1&two=2");
    assert.equal(
      updated.image,
      "https://portfolio.test/tea/api/media/file/sharing-image",
    );
    assert.equal(published.includes(description), false);
    assert.match(
      published,
      /<title>Selected work \| Composer &amp; Artist<\/title>/,
    );

    const home = store.homepage();
    store.savePage(
      "",
      { ...home, seo: { ...home.seo, title: "Homepage search title" } },
      home.revision,
    );
    assert.equal(
      graph(await html(routes.home.href()))[1].name,
      "Homepage search title",
    );
    const settings = store.site();
    store.saveSite({ ...settings, description: "" }, settings.revision);
    const empty = graph(await html(routes.home.href()));
    assert.equal("description" in empty[0], false);
    assert.equal("description" in empty[1], false);
    assert.equal("image" in empty[1], false);

    const hidden = store.page("gallery")!;
    store.savePage(
      "gallery",
      { ...hidden, seo: { ...hidden.seo, no_index: true } },
      hidden.revision,
    );
    for (const path of [
      "/gallery",
      "/?preview",
      "/not-a-page",
      routes.auth.login.href(),
    ]) {
      assert.equal(
        (await html(path)).includes('type="application/ld+json"'),
        false,
      );
    }
  } finally {
    database.sqlite.close();
  }
});

it("includes configured analytics once on public pages, never in the CMS or previews", async () => {
  const previous = process.env.GOOGLE_ANALYTICS_ID;
  const database = await openDatabase(":memory:");
  try {
    process.env.GOOGLE_ANALYTICS_ID = "G-YKGRMT757F";
    const store = new ContentStore(database.sqlite);
    store.createPage("Gallery", "gallery");
    store.publishDraft("gallery", store.editorPage("gallery")!.revision);
    const user = database.sqlite
      .prepare("INSERT INTO users (email,password_hash) VALUES (?,?)")
      .run("analytics-test@example.test", "unused-test-hash");
    const session = new AuthStore(database.sqlite).createSession(
      Number(user.lastInsertRowid),
    );
    const router = createTeaRouter(database);
    const request = (path: string, init: RequestInit = {}) =>
      router.fetch(new Request("http://localhost" + path, init));
    for (const path of ["/", "/gallery"]) {
      const html = await (await request(path)).text();
      assert.equal(
        (html.match(/googletagmanager\.com\/gtag\/js/g) ?? []).length,
        1,
      );
      assert.match(html, /gtag\('config', "G-YKGRMT757F"\)/);
      assert.match(html, /rel="canonical"/);
    }
    for (const path of [
      "/?preview",
      "/gallery?preview",
      routes.auth.login.href(),
      routes.admin.edit.href({ slug: "gallery" }),
    ]) {
      const response = await request(path, {
        headers: path.startsWith("/tea/admin")
          ? { Cookie: `tea-session=${session.id}` }
          : {},
      });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.equal(html.includes("googletagmanager.com"), false);
      assert.equal(html.includes('type="application/ld+json"'), false);
    }
    const preview = await request(routes.admin.preview.href(), {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        Cookie: `tea-session=${session.id}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(store.editorPage("gallery")),
    });
    assert.equal(preview.status, 200);
    const previewHtml = await preview.text();
    assert.equal(previewHtml.includes("googletagmanager.com"), false);
    assert.equal(previewHtml.includes('type="application/ld+json"'), false);
    delete process.env.GOOGLE_ANALYTICS_ID;
    assert.equal(
      (await (await request("/")).text()).includes("googletagmanager.com"),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_ANALYTICS_ID;
    else process.env.GOOGLE_ANALYTICS_ID = previous;
    database.sqlite.close();
  }
});

it("serves public content and protects editor reads, writes and login", async () => {
  const database = await openDatabase(":memory:");
  database.sqlite
    .prepare("INSERT INTO users (email,password_hash) VALUES (?,?)")
    .run("editor@test.local", await bcrypt.hash("test-only-password", 4));
  const store = new ContentStore(database.sqlite);
  store.createPage("Gallery", "gallery");
  assert.equal(store.page("gallery"), null);
  store.publishDraft("gallery", store.editorPage("gallery")!.revision);
  const router = createTeaRouter(database);
  const request = (path: string, init: RequestInit = {}) =>
    router.fetch(new Request("http://localhost" + path, init));
  try {
    const publicPage = await request("/gallery");
    assert.equal(publicPage.status, 200);
    assert.match(await publicPage.text(), /Gallery \| Andrew Gosse/);
    assert.equal((await request("/not-a-page")).status, 404);
    assert.equal((await request(routes.admin.pages.href())).status, 303);
    assert.equal(
      (
        await request(routes.auth.authenticate.href(), {
          method: "POST",
          headers: { Origin: "https://elsewhere.test" },
        })
      ).status,
      403,
    );
    const login = await request(routes.auth.authenticate.href(), {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: "editor@test.local",
        password: "test-only-password",
      }),
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const admin = await request(routes.admin.edit.href({ slug: "gallery" }), {
      headers: { Cookie: cookie },
    });
    assert.equal(admin.status, 200);
    assert.match(await admin.text(), /Page editor/);
    const page = store.page("gallery")!;
    const saveInit = {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        Cookie: cookie,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...page, title: "New gallery title" }),
    };
    assert.equal(
      (await request(routes.admin.save.href({ slug: "gallery" }), saveInit))
        .status,
      200,
    );
    assert.equal(store.page("gallery")!.title, "Gallery");
    assert.equal(store.editorPage("gallery")!.title, "New gallery title");
    assert.equal(
      (
        await request(routes.admin.publish.href({ slug: "gallery" }), {
          ...saveInit,
          body: JSON.stringify({
            revision: store.editorPage("gallery")!.revision,
          }),
        })
      ).status,
      200,
    );
    assert.equal(store.page("gallery")!.title, "New gallery title");
    assert.equal(
      (await request(routes.admin.save.href({ slug: "gallery" }), saveInit))
        .status,
      409,
    );
    assert.equal(
      (
        await request(routes.auth.logout.href(), {
          method: "POST",
          headers: { Origin: "http://localhost", Cookie: cookie },
        })
      ).status,
      303,
    );
    assert.equal(
      (
        await request(routes.admin.pages.href(), {
          headers: { Cookie: cookie },
        })
      ).status,
      303,
    );
  } finally {
    database.sqlite.close();
  }
});
