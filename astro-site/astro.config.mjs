// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import metaTags from "astro-meta-tags";
import react from "@astrojs/react";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@graphql-typed-document-node/core"],
    },
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
    }),
  ],
});
