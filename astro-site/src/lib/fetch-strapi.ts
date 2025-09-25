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
