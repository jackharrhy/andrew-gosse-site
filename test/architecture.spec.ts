import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

test("runtime modules remain below the review's 1,000-line threshold", () => {
  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    });
  }
  for (const path of [...files("app"), ...files("public/admin")]) {
    if (!/[.](tsx?|css)$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    expect(source.split("\n").length, path).toBeLessThan(1000);
    if (path.endsWith(".css")) expect(source, path).not.toMatch(/:\s*;/);
  }
});
