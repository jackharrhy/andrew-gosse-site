import { defineLiveCollection } from "astro:content";
import { strapiPagesLoader } from "./lib/fetch-strapi";

const pages = defineLiveCollection({
  loader: strapiPagesLoader(),
});

export const collections = {
  pages,
};
