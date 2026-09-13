import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("CMS colors use OKLCH tokens and interface copy stays plain", () => {
  const css = ["core", "editor", "library", "workspace"]
    .map((name) => readFileSync(`public/admin/${name}.css`, "utf8"))
    .join("\n");
  expect(css).toContain("oklch(");
  expect(css).not.toContain("prefers-color-scheme: dark");
  expect(css).not.toMatch(/var\([^)]+\)-[a-z]+\s*:/);
  expect(css).not.toMatch(
    /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(|:\s*(?:white|black)\b/i,
  );
  for (const file of [
    "overview.tsx",
    "layout.tsx",
    "pages.tsx",
    "search-appearance.tsx",
  ]) {
    const source = readFileSync("app/actions/admin/" + file, "utf8");
    expect(source).not.toMatch(
      /little corner|next thing|small obsession|housekeeping|[—–]/i,
    );
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`CMS ${colorScheme} theme has readable colors and responsive screens`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/tea/login");
    await page.screenshot({ path: `tmp/tea-login-${colorScheme}.png` });
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toBe("light");
    const contrasts = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      function luminance(token: string) {
        context.fillStyle = style.getPropertyValue(token).trim();
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      }
      return [
        ["--ink", "--canvas", 7],
        ["--muted", "--canvas", 4.5],
        ["--muted", "--paper", 4.5],
        ["--muted", "--surface", 4.5],
        ["--on-accent", "--accent", 4.5],
        ["--on-accent", "--accent-hover", 4.5],
        ["--accent", "--accent-soft", 4.5],
        ["--accent", "--paper", 4.5],
        ["--on-tea", "--tea", 4.5],
        ["--danger", "--danger-soft", 4.5],
        ["--field-border", "--paper", 3],
      ].map(([a, b, minimum]) => {
        const x = luminance(String(a)),
          y = luminance(String(b));
        return {
          pair: `${a} / ${b}`,
          ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05),
          minimum: Number(minimum),
        };
      });
    });
    for (const item of contrasts)
      expect(item.ratio, item.pair).toBeGreaterThanOrEqual(item.minimum);

    await page.getByLabel("Email address").fill("browser-test@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-only-browser-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    for (const path of [
      "",
      "/pages",
      "/homepage",
      "/pages/about",
      "/media",
      "/sidebar",
      "/adornments",
      "/seo",
      "/site",
    ]) {
      await page.goto("/tea/admin" + path);
      await expect(page.locator("#workspace")).not.toHaveAttribute("inert");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path,
      ).toBe(true);
      if (["", "/pages/about", "/media", "/site"].includes(path)) {
        await page.screenshot({
          path: `tmp/tea-${path.replaceAll("/", "-") || "overview"}-${colorScheme}.png`,
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `mobile ${path}`,
      ).toBe(true);
      if (path === "/pages/about")
        await page.screenshot({ path: `tmp/tea-mobile-${colorScheme}.png` });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto("/tea/admin/media");
    await page
      .getByRole("button")
      .filter({ has: page.locator("img") })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "File details" }),
    ).toBeVisible();
    await page.goto("/tea/admin/pages/about");
    await page
      .getByRole("button", { name: "Change image", exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: `tmp/tea-picker-${colorScheme}.png` });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
}
