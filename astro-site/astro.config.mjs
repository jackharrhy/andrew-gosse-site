// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import node from "@astrojs/node";

// https://astro.build/config
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

  experimental: {
    liveContentCollections: false,
  },
});
