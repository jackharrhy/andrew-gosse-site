import { test, expect } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/tea/login");
  await page.getByLabel("Email address").fill("browser-test@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}

test("native Remix editor preserves a real page through editing and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tea/login");
  await page.getByLabel("Email address").fill("browser-test@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/cms-overview.png", fullPage: true });
  await page.goto("/tea/admin/pages/about");
  await expect(
    page.getByRole("textbox", { name: "Page title", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/cms-editor.png", fullPage: true });
  await page
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill("About Andrew — browser verified");
  await expect(page.getByRole("status")).toHaveText("Draft saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Page title", exact: true }),
  ).toHaveValue("About Andrew — browser verified");
  const paragraph = page
    .getByRole("textbox", { name: "paragraph content" })
    .first();
  await paragraph.fill("A real editing round trip in Remix 3.");
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await expect(page.getByRole("status")).toHaveText("Draft saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "paragraph content" }).first(),
  ).toHaveText("A real editing round trip in Remix 3.");
  expect(await (await page.request.get("/about")).text()).not.toContain(
    "A real editing round trip in Remix 3.",
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Published");
  await page.goto("/about");
  await expect(page.locator("article")).toContainText(
    "A real editing round trip in Remix 3.",
  );
  expect(errors).toEqual([]);
});

test("media, navigation, adornments and settings support complete editing flows", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/media");
  await page.locator("input[type=file]").setInputFiles("public/favicon.png");
  await expect(page.getByRole("status")).toContainText("File uploaded");
  await page
    .getByLabel("Alternative text", { exact: true })
    .fill("Browser test artwork");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status")).toContainText("File details saved");
  await page
    .getByRole("button", { name: "Remove from library" })
    .click({ trial: true });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove from library" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Removed from the library",
  );
  await page.goto("/tea/admin/sidebar");
  await page.getByLabel("Category title").first().fill("Listen — verified");
  await page.getByRole("button", { name: "Save navigation" }).click();
  await expect(page.getByRole("status")).toContainText("Navigation saved");
  await page.reload();
  await expect(page.getByLabel("Category title").first()).toHaveValue(
    "Listen — verified",
  );
  await page.goto("/tea/admin/adornments");
  await page.getByRole("button", { name: "New adornment" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Browser test adornment");
  await page.getByRole("button", { name: "Choose artwork" }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose an image", exact: true }),
  ).toBeVisible();
  await page.locator(".picker-image").first().click();
  await page.getByRole("slider", { name: "Angle" }).fill("5");
  await page
    .getByRole("button", { name: "Save adornment", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Adornment saved");
  await page.getByRole("button", { name: "Browser test adornment" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove adornment" }).click();
  await expect(page.getByRole("status")).toContainText("Adornment removed");
  await page.goto("/tea/admin/site");
  await page
    .getByLabel("Default description")
    .fill("Music and art from Newfoundland — verified.");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Site settings saved");
  await page.goto("/");
  await expect(page.locator("meta[name=description]")).toHaveAttribute(
    "content",
    "Music and art from Newfoundland — verified.",
  );
});

test("editor adds formatted blocks, previews and rejects stale overwrites", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/pages/gallery");
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  await page.getByRole("button", { name: "+ Text", exact: true }).click();
  const text = page.getByRole("textbox", { name: "paragraph content" }).last();
  await text.fill("A fresh gallery note.");
  await text.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Bold", exact: true }).last().click();
  await page.getByRole("button", { name: "Refresh preview" }).click();
  await expect(
    page.frameLocator('iframe[title="Page preview"]').locator("article"),
  ).toContainText("A fresh gallery note.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  const other = await context.newPage();
  await other.goto("/tea/admin/pages/gallery");
  await other.getByLabel("Autosave draft", { exact: true }).uncheck();
  await page
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill("New gallery");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await other
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill("Stale gallery");
  await other.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText(
    "changed in another tab",
  );
  await expect(
    other.getByRole("textbox", { name: "Page title", exact: true }),
  ).toHaveValue("Stale gallery");
  await other.close();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Page title", exact: true }),
  ).toHaveValue("New gallery");
  await expect(
    page
      .getByRole("textbox", { name: "paragraph content" })
      .last()
      .locator("strong,b"),
  ).toContainText("A fresh gallery note.");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Earlier versions" }),
  ).toBeVisible();
});

test("editor restores title-only drafts and supports reorder, undo and redo", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/pages/contact");
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  await page
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill("Recovered contact title");
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Recover draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Page title", exact: true }),
  ).toHaveValue("Recovered contact title");
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "+ Text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "paragraph content" })
    .last()
    .fill("Move this note");
  await page
    .getByRole("button", { name: "Move block up", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("textbox", { name: "paragraph content" }).last(),
  ).toHaveText("Move this note");
  await page.getByRole("button", { name: "Redo" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Page title", exact: true }),
  ).toHaveValue("Recovered contact title");
});

test("public pages, media and CMS screens render on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("article")).toContainText("Noticeboard");
  const media = await page.locator("article img").first().getAttribute("src");
  expect((await page.request.get(media!)).status()).toBe(200);
  await page.screenshot({ path: "tmp/remix-homepage.png", fullPage: true });
  await page.goto("/tea/login");
  await page.getByLabel("Email address").fill("browser-test@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const path of [
    "pages",
    "homepage",
    "media",
    "sidebar",
    "adornments",
    "seo",
    "site",
  ]) {
    await page.goto("/tea/admin/" + path);
    await expect(page.locator("main h1")).toBeVisible();
    await page.screenshot({
      path: `tmp/cms-${path}.png`,
      fullPage: path !== "media",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tea/admin/pages");
  await expect(page.locator("main h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tmp/cms-mobile.png", fullPage: true });
});
