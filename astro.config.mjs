// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import metaTags from "astro-meta-tags";
import react from "@astrojs/react";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import { contentBlocksPlugin } from "@andrew-gosse-site/plugin-content-blocks";

export default defineConfig({
  site: "https://andrewgosse.com",
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: node({
    mode: "standalone",
  }),
  output: "server",
  integrations: [
    react(),
    metaTags(),
    emdash({
      database: sqlite({ url: "file:./data/emdash.db" }),
      storage: local({
        directory: "./data/uploads",
        baseUrl: "/_emdash/api/media/file",
      }),
      plugins: [contentBlocksPlugin()],
    }),
  ],
});
