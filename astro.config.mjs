// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import metaTags from "astro-meta-tags";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://andrewgosse.com",
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["better-sqlite3", "bcryptjs"],
    },
  },
  adapter: node({ mode: "standalone" }),
  output: "server",
  integrations: [react(), metaTags()],
});
