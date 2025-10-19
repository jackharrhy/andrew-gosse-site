import { graphql } from "../graphql";
import { execute } from "../graphql/execute";

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

export async function fetchPages() {
  const result = await execute(PagesQuery);
  return result.data!.pages!;
}

export async function fetchPage(slug: string) {
  // TODO make this reach out to the api rather than filter all
  const pages = await fetchPages();
  const page = pages.find((p) => p!.slug === slug);
  if (!page) {
    throw new Error(`Page with slug "${slug}" not found`);
  }
  return page;
}
