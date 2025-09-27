import type { Loader, LoaderContext } from "astro/loaders";

import { graphql } from "../graphql";
import { execute } from "../graphql/execute";
import { z } from "astro:content";

export const HomepageQuery = graphql(`
  query Homepage {
    homepage {
      seo {
        metaTitle
        metaDescription
        shareImage {
          url
        }
      }
      blocks {
        ... on ComponentSharedRichText {
          __typename
          body
        }
        ... on ComponentSharedMedia {
          __typename
          file {
            url
            alternativeText
          }
        }
      }
    }
  }
`);

export async function fetchHomepage() {
  const result = await execute(HomepageQuery);
  return result.data?.homepage;
}

export const SidebarQuery = graphql(`
  query Sidebar {
    sidebar {
      topImage {
        url
        alternativeText
      }
      categories {
        categoryTitle
        items {
          text
          page {
            slug
          }
        }
      }
      links {
        service
        url
      }
    }
  }
`);

export async function fetchSidebar() {
  const result = await execute(SidebarQuery);
  return result.data!.sidebar!;
}

export const PagesQuery = graphql(`
  query Pages {
    pages(pagination: { pageSize: 100 }) {
      slug
      seo {
        metaTitle
        metaDescription
        shareImage {
          url
        }
      }
      blocks {
        ... on ComponentSharedRichText {
          body
        }
        ... on ComponentSharedMedia {
          file {
            url
            alternativeText
          }
        }
      }
    }
  }
`);

export async function fetchPages() {
  const result = await execute(PagesQuery);
  return result.data!.pages!;
}

export function strapiPagesLoader(): Loader {
  return {
    name: "strapi-pages-loader",
    load: async ({ store }: LoaderContext): Promise<void> => {
      const pages = await fetchPages();

      for (const page of pages) {
        console.log(page);
        store.set({
          id: page!.slug,
          data: page!,
        });
      }
    },
    schema: async () =>
      z.object({
        slug: z.string(),
        seo: z.object({
          metaTitle: z.string(),
          metaDescription: z.string(),
          shareImage: z.object({ url: z.string() }),
        }),
        blocks: z.array(
          z.discriminatedUnion("__typename", [
            z.object({
              __typename: z.literal("ComponentSharedRichText"),
              body: z.string(),
            }),
            z.object({
              __typename: z.literal("ComponentSharedMedia"),
              file: z.object({
                url: z.string(),
                alternativeText: z.string(),
              }),
            }),
          ])
        ),
      }),
  };
}
