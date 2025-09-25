import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  loader: async () => {
    return [];
  },
  schema: z.object({
    id: z.number(),
  }),
});

export const collections = {
  // pages,
};
