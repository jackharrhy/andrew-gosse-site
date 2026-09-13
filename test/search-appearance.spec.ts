import { test, expect } from "@playwright/test";

test("search checklist opens SEO fields and compares saved drafts without changing the live page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tea/login");
  await page.getByLabel("Email address").fill("browser-test@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-only-browser-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const liveBefore = await (await page.request.get("/")).text();
  await page.goto("/tea/admin/seo");
  const homepage = page.getByRole("region", { name: "Homepage", exact: true });
  await expect(homepage).toContainText("Live");
  await homepage.getByRole("link", { name: "Edit search & sharing" }).click();
  await expect(page).toHaveURL(
    /\/tea\/admin\/homepage\?section=seo#search-sharing$/,
  );
  const description = page.getByLabel("Search description");
  await expect(description).toBeVisible();
  await expect(description).toBeInViewport();
  await page.getByLabel("Autosave draft", { exact: true }).uncheck();
  await description.fill("A saved draft for the search checklist.");
  await page.getByRole("button", { name: "Choose sharing image" }).click();
  await page.locator(".picker-image").first().click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.goto("/tea/admin/seo");
  await expect(homepage).toContainText("Unpublished changes");
  await homepage.getByText("Compare saved draft", { exact: true }).click();
  await expect(homepage.locator(".seo-draft")).toContainText(
    "A saved draft for the search checklist.",
  );
  const sharingImage = homepage.getByRole("img", { name: "Sharing image" });
  await expect(sharingImage).toBeVisible();
  await expect
    .poll(() =>
      sharingImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(homepage.locator(":scope > .seo-preview")).not.toContainText(
    "A saved draft for the search checklist.",
  );
  const liveAfter = await (await page.request.get("/")).text();
  expect(liveAfter).toBe(liveBefore);
  await page.screenshot({
    path: "tmp/seo-checklist-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /^Unpublished changes/ }).click();
  await expect(page).toHaveURL(/filter=drafts/);
  await expect(homepage).toBeVisible();
  await page.getByRole("link", { name: /^Missing details/ }).click();
  await expect(page).toHaveURL(/filter=missing/);
  await homepage.getByText("Compare saved draft", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    homepage.getByRole("link", { name: "Edit search & sharing" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "tmp/seo-checklist-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
