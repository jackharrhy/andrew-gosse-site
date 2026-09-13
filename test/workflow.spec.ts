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

test("new pages stay private while TipTap edits update the live draft preview", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/pages");
  await page.getByText("Create a new page", { exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Private review");
  await page.getByLabel("Website URL").fill("private-review");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(
    page.getByRole("heading", { name: "Private review", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/private-review")).status()).toBe(404);
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  await page.getByRole("button", { name: "+ Text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "paragraph content" })
    .fill("A private note in TipTap.");
  await expect(
    page.frameLocator('iframe[title="Page preview"]').locator("article"),
  ).toContainText("A private note in TipTap.");
  expect((await page.request.get("/private-review")).status()).toBe(404);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Published");
  expect(await (await page.request.get("/private-review")).text()).toContain(
    "A private note in TipTap.",
  );
});

test("media supports folders, subfolders, descriptions and moving files without new URLs", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/media");
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByLabel("Folder name").fill("Artwork tests");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Reusable paper scans");
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.locator(".folder-heading")).toContainText(
    "Reusable paper scans",
  );
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByLabel("Folder name").fill("Tape tests");
  await page.getByRole("button", { name: "Save folder" }).click();
  await expect(page.locator(".folder-heading h2")).toHaveText(
    "Artwork tests / Tape tests",
  );
  await page.locator("input[type=file]").setInputFiles("public/favicon.png");
  await expect(page.getByRole("status")).toHaveText("File uploaded.");
  const original = await page
    .getByRole("link", { name: "Open original" })
    .getAttribute("href");
  await page.getByLabel("Notes").fill("Test scan, keep original URL");
  await page.getByLabel("Alternative text", { exact: true }).fill("Paper test");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status")).toHaveText("File details saved.");
  await page.reload();
  await page.getByRole("button", { name: "▱ Tape tests", exact: true }).click();
  await page.locator(".media-tile").first().click();
  await expect(page.getByLabel("Notes")).toHaveValue(
    "Test scan, keep original URL",
  );
  await page
    .getByRole("combobox", { name: "Folder", exact: true })
    .selectOption({ label: "Artwork tests" });
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status")).toHaveText("File details saved.");
  await expect(page.locator(".media-tile")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open original" }),
  ).toHaveAttribute("href", original!);
  await page.screenshot({ path: "tmp/workflow-media-folders.png" });
});

test("left handles reorder blocks with pointer and keyboard, and survive reload", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/pages/about");
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  const blocks = page.locator(".block-card");
  const first = await blocks.first().getAttribute("data-block-id");
  const second = await blocks.nth(1).getAttribute("data-block-id");
  const grip = await blocks.first().locator(".block-drag").boundingBox();
  const target = await blocks.nth(1).boundingBox();
  await page.mouse.move(grip!.x + 10, grip!.y + 10);
  await page.mouse.down();
  await page.mouse.move(target!.x + 80, target!.y + 30, { steps: 8 });
  await page.mouse.up();
  await expect(blocks.first()).toHaveAttribute("data-block-id", second!);
  await expect(blocks.nth(1)).toHaveAttribute("data-block-id", first!);
  await blocks.nth(1).locator(".block-drag").press("ArrowUp");
  await expect(blocks.first()).toHaveAttribute("data-block-id", first!);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await expect(blocks.first()).toHaveAttribute("data-block-id", first!);
});

test("adornments edit in a dialog and image placements stay in the page draft", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tea/admin/adornments");
  await page
    .getByRole("button", { name: "tape top left 1", exact: true })
    .click();
  const suite = page.getByRole("dialog", {
    name: "Adornment editor",
    exact: true,
  });
  await expect(suite).toBeVisible();
  const photo = await suite.locator(".composition-photo").getAttribute("src");
  await expect(
    suite.getByRole("combobox", { name: "Preview image" }),
  ).toHaveValue(photo!.split("/").at(-1)!);
  await suite.getByRole("slider", { name: "Angle", exact: true }).fill("12");
  await expect(suite.locator(".composition-layer")).toHaveCSS(
    "transform",
    /matrix/,
  );
  await page.screenshot({ path: "tmp/workflow-adornment-suite.png" });
  await page.keyboard.press("Escape");
  await expect(suite).not.toBeVisible();
  const publicBefore = await (await page.request.get("/about")).text();
  await page.goto("/tea/admin/pages/about");
  const layer = page.locator(".image-block .composition-layer").first();
  const before = await layer.getAttribute("style");
  await layer.press("ArrowRight");
  await expect(layer).not.toHaveAttribute("style", before!);
  await page.getByRole("slider", { name: "Angle", exact: true }).fill("15");
  await expect(page.getByRole("status")).toHaveText("Draft saved", {
    timeout: 15000,
  });
  await page.reload();
  await expect(layer).toHaveAttribute("style", /rotate\(15deg\)/);
  expect(await (await page.request.get("/about")).text()).toBe(publicBefore);
  await page.screenshot({ path: "tmp/workflow-image-placement.png" });
});
