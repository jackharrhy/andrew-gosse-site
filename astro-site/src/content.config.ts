import { defineCollection } from "astro:content";
import { strapiPagesLoader } from "./lib/fetch-strapi";

const pages = defineCollection({
  loader: strapiPagesLoader(),
});

export const collections = {
  pages,
};
