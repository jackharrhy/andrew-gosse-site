import { it } from "remix/test";
import * as assert from "remix/assert";
import bcrypt from "bcryptjs";
import { openDatabase } from "../data/database.ts";
import { createTeaRouter } from "../router.ts";
import { ContentStore } from "../data/content.ts";
import { routes } from "../routes.ts";

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
