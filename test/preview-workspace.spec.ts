import { test, expect } from "@playwright/test";

async function editor(page: import("@playwright/test").Page) {
  await page.goto("/tea/login");
  await page.getByLabel("Email address").fill("browser-test@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.goto("/tea/admin/pages/about");
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
}

test("image tilt, borders, sizing and adornment geometry match the rendered preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await editor(page);
  const image = page.locator(".image-block").first();
  await image
    .getByRole("slider", { name: "Image tilt", exact: true })
    .fill("12");
  await image
    .getByRole("combobox", { name: "Image border", exact: true })
    .selectOption("solid");
  await image
    .getByRole("slider", { name: "Border width", exact: true })
    .fill("6");
  await image.getByLabel("Border color", { exact: true }).fill("#336655");
  await image.getByText("Advanced image layout", { exact: true }).click();
  await image.getByRole("textbox", { name: "width", exact: true }).fill("100%");
  await image
    .getByRole("textbox", { name: "padding", exact: true })
    .fill("10px");
  const src = await image.locator(".composition-photo").getAttribute("src");
  const rendered = page
    .frameLocator('iframe[title="Page preview"]')
    .locator(`.image-with-adornments:has(> img[src="${src}"])`);
  await expect(rendered.locator("img").first()).toHaveCSS(
    "border-left-width",
    "6px",
  );
  await expect(image.locator(".composition-photo")).toHaveCSS(
    "border-left-color",
    "rgb(51, 102, 85)",
  );
  const geometry = (node: HTMLElement) => {
    const photo = node.querySelector("img")!;
    const tape = node.querySelectorAll("img")[1];
    return {
      width: node.offsetWidth,
      height: node.offsetHeight,
      transform: getComputedStyle(node).transform,
      photoWidth: photo.offsetWidth,
      photoHeight: photo.offsetHeight,
      tapeLeft: tape.offsetLeft,
      tapeTop: tape.offsetTop,
      tapeWidth: tape.offsetWidth,
    };
  };
  await expect
    .poll(async () => image.locator(".composition").evaluate(geometry))
    .toEqual(await rendered.evaluate(geometry));
  const tape = image.locator(".composition-layer").first();
  await tape.scrollIntoViewIfNeeded();
  const before = await tape.evaluate((node) => ({
    left: (node as HTMLElement).offsetLeft,
    top: (node as HTMLElement).offsetTop,
  }));
  const scale = await image
    .locator(".composition-scene")
    .evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);
  const box = await tape.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 24,
    box!.y + box!.height / 2,
    { steps: 6 },
  );
  await page.mouse.up();
  const after = await tape.evaluate((node) => ({
    left: (node as HTMLElement).offsetLeft,
    top: (node as HTMLElement).offsetTop,
  }));
  expect(
    Math.abs(
      after.left - before.left - (24 * Math.cos((12 * Math.PI) / 180)) / scale,
    ),
  ).toBeLessThan(2);
  expect(
    Math.abs(
      after.top - before.top + (24 * Math.sin((12 * Math.PI) / 180)) / scale,
    ),
  ).toBeLessThan(2);
  await page.screenshot({ path: "tmp/preview-image-parity.png" });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await expect(
    image.getByRole("slider", { name: "Image tilt", exact: true }),
  ).toHaveValue("12");
  await expect(
    image.getByRole("combobox", { name: "Image border", exact: true }),
  ).toHaveValue("solid");
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  const choices = image.getByRole("button", { name: /^Remove adornment / });
  while (await choices.count()) await choices.first().click();
  const plain = page
    .frameLocator('iframe[title="Page preview"]')
    .locator(`article.prose > img[src="${src}"]`);
  await expect(plain).toBeVisible();
  const photoGeometry = (node: HTMLImageElement) => ({
    width: node.offsetWidth,
    height: node.offsetHeight,
    border: getComputedStyle(node).border,
    transform: getComputedStyle(node).transform,
  });
  await expect
    .poll(() => image.locator(".composition-photo").evaluate(photoGeometry))
    .toEqual(await plain.evaluate(photoGeometry));
  expect(errors).toEqual([]);
});

test("sidebar collapse and pointer/keyboard resizing give the preview real mobile and desktop widths", async ({
  page,
}) => {
  await editor(page);
  await page.getByRole("button", { name: "Hide navigation" }).click();
  await expect(page.locator("#cms-navigation")).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill("Layout keeps this draft");
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('iframe[title="Page preview"]')
        .evaluate((node) => node.clientWidth),
    )
    .toBe(390);
  const separator = page.getByRole("separator", {
    name: "Resize editor and preview",
  });
  const box = await separator.boundingBox();
  const bounds = await page.locator(".editor-split").boundingBox();
  await page.mouse.move(box!.x + 8, Math.max(320, box!.y + 50));
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 268, Math.max(320, box!.y + 50), {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      page
        .locator('iframe[title="Page preview"]')
        .evaluate((node) => node.clientWidth),
    )
    .toBeGreaterThan(1024);
  await expect
    .poll(() =>
      page
        .locator(".image-appearance")
        .first()
        .evaluate(
          (node) =>
            getComputedStyle(node).gridTemplateColumns.split(" ").length,
        ),
    )
    .toBe(1);
  await expect(
    page.getByRole("textbox", { name: "Page title", exact: true }),
  ).toHaveValue("Layout keeps this draft");
  await expect(
    page.frameLocator('iframe[title="Page preview"]').locator(".site-menu"),
  ).toHaveAttribute("open", "");
  await separator.press("End");
  await expect
    .poll(() =>
      page
        .locator('iframe[title="Page preview"]')
        .evaluate((node) => node.clientWidth),
    )
    .toBe(280);
  await separator.press("Home");
  await expect
    .poll(() =>
      page.locator(".editor-pane").evaluate((node) => node.clientWidth),
    )
    .toBe(240);
  await page.screenshot({ path: "tmp/preview-wide-workspace.png" });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await expect(page.locator("#cms-navigation")).not.toBeVisible();
  await expect
    .poll(() =>
      page.locator(".editor-pane").evaluate((node) => node.clientWidth),
    )
    .toBe(240);
  await page.getByRole("button", { name: "Show navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "CMS navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide preview", exact: true }).click();
  await expect(page.locator(".editor-pane")).toBeVisible();
  await expect(page.locator('iframe[title="Page preview"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Show preview", exact: true }).click();
  await expect(page.locator('iframe[title="Page preview"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(separator).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
