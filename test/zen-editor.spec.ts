import { test, expect } from "@playwright/test";

async function openEditor(page: import("@playwright/test").Page) {
  await page.goto("/tea/login");
  await page.getByLabel("Email address").fill("browser-test@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/tea/admin/pages/about");
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
}

test("mobile navigation opens and closes without covering the editor permanently", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  await expect(page.locator("#cms-navigation")).not.toBeVisible();
  await page.getByRole("button", { name: "Show navigation" }).click();
  await expect(page.locator("#cms-navigation")).toBeVisible();
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(page.locator("#cms-navigation")).not.toBeVisible();
  await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toBeVisible();
});

test("repeat artwork, edit each placement, remove one, and reload without publishing", async ({
  page,
}) => {
  await openEditor(page);
  const before = await (await page.request.get("/about")).text();
  const image = page.locator(".image-block").first();
  const initial = await image.locator(".adornment-instance").count();
  await image
    .getByRole("button", { name: "Add adornment", exact: true })
    .click();
  const artwork = image.locator(".compact-choices button").first();
  const name = (await artwork.innerText()).trim();
  await artwork.click();
  await image
    .getByRole("button", { name: "Add adornment", exact: true })
    .click();
  await image
    .locator(".compact-choices button")
    .filter({ hasText: name })
    .first()
    .click();
  const instances = image.locator(".adornment-instance");
  await expect(instances).toHaveCount(initial + 2);
  expect(
    await instances.nth(initial).getAttribute("data-instance-id"),
  ).not.toBe(await instances.nth(initial + 1).getAttribute("data-instance-id"));
  await image.getByRole("slider", { name: "Angle", exact: true }).fill("27");
  await expect(image.locator(".composition-layer").last()).toHaveAttribute(
    "style",
    /rotate\(27deg\)/,
  );
  await image
    .getByRole("button", {
      name: `Remove adornment ${initial + 1}`,
      exact: true,
    })
    .click();
  await expect(instances).toHaveCount(initial + 1);
  await expect(image.locator(".composition-layer").last()).toHaveAttribute(
    "style",
    /rotate\(27deg\)/,
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await expect(instances).toHaveCount(initial + 1);
  await expect(image.locator(".composition-layer").last()).toHaveAttribute(
    "style",
    /rotate\(27deg\)/,
  );
  expect(await (await page.request.get("/about")).text()).toBe(before);
});

test("preview stays mounted while typing, resizing and collapsing a full-height workspace", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openEditor(page);
  const iframe = page.locator('iframe[title="Page preview"]');
  const preview = page.frameLocator('iframe[title="Page preview"]');
  await expect(preview.locator("article.prose")).toBeVisible();
  await iframe.evaluate((node) => {
    const frame = node as HTMLIFrameElement;
    const doc = frame.contentDocument!;
    (frame as any).originalDocument = doc;
    (frame as any).originalImage = doc.querySelector("article img");
    (frame as any).loads = 0;
    frame.addEventListener("load", () => (frame as any).loads++);
    frame.contentWindow!.scrollTo(0, 100);
  });
  const text = page.locator('.rich-text[contenteditable="true"]').first();
  await text.fill("A quiet preview");
  await expect(preview.locator("article.prose")).toContainText(
    "A quiet preview",
  );
  expect(
    await iframe.evaluate((node) => {
      const f = node as HTMLIFrameElement & {
        originalDocument: Document;
        originalImage: Element;
        loads: number;
      };
      return {
        sameDocument: f.originalDocument === f.contentDocument,
        sameImage:
          f.originalImage === f.contentDocument!.querySelector("article img"),
        loads: f.loads,
      };
    }),
  ).toEqual({ sameDocument: true, sameImage: true, loads: 0 });
  const box = await iframe.boundingBox();
  expect(box!.y).toBe(0);
  expect(box!.height).toBe(page.viewportSize()!.height);
  await page.getByRole("button", { name: "Hide navigation" }).click();
  await page
    .getByRole("button", { name: "Collapse editor", exact: true })
    .click();
  await expect(page.locator(".editor-scroll")).not.toBeVisible();
  expect(
    await page.locator(".editor-pane").evaluate((n) => n.clientWidth),
  ).toBe(48);
  const full = await iframe.boundingBox();
  expect(full!.height).toBe(page.viewportSize()!.height);
  expect(full!.width).toBeGreaterThan(page.viewportSize()!.width - 70);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(text).toContainText("A quiet preview");
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect.poll(() => iframe.evaluate((n) => n.clientWidth)).toBe(390);
  expect(await iframe.evaluate((n) => (n as any).loads)).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "tmp/zen-editor.png" });
});
