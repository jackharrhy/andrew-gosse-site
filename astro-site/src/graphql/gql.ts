/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query Homepage {\n    homepage {\n      seo {\n        metaTitle\n        metaDescription\n        shareImage {\n          url\n        }\n      }\n      blocks {\n        ... on ComponentSharedRichText {\n          __typename\n          body\n        }\n        ... on ComponentSharedMedia {\n          __typename\n          file {\n            url\n            alternativeText\n          }\n          width\n          height\n          rotation\n          border\n          adornments {\n            media {\n              file {\n                url\n                alternativeText\n              }\n              left\n              top\n              bottom\n              right\n              width\n              height\n              rotation\n            }\n          }\n        }\n        ... on ComponentSharedSpecialComponent {\n          __typename\n          type\n        }\n      }\n    }\n  }\n": typeof types.HomepageDocument,
    "\n  query Site {\n    sidebar {\n      topImage {\n        url\n        alternativeText\n      }\n      categories {\n        categoryTitle\n        backgroundImage {\n          url\n        }\n        items {\n          text\n          page {\n            slug\n          }\n        }\n      }\n      links {\n        service\n        url\n      }\n      listAdornments {\n        media {\n          file {\n            url\n          }\n        }\n      }\n    }\n    site {\n      backgroundColor\n    }\n  }\n": typeof types.SiteDocument,
    "\n  query Pages {\n    pages(pagination: { pageSize: 100 }) {\n      slug\n      seo {\n        metaTitle\n        metaDescription\n        shareImage {\n          url\n        }\n      }\n      blocks {\n        ... on ComponentSharedRichText {\n          __typename\n          body\n        }\n        ... on ComponentSharedMedia {\n          __typename\n          file {\n            url\n            alternativeText\n          }\n          width\n          height\n          rotation\n          border\n          adornments {\n            media {\n              file {\n                url\n                alternativeText\n              }\n              left\n              top\n              bottom\n              right\n              width\n              height\n              rotation\n            }\n          }\n        }\n        ... on ComponentSharedSpecialComponent {\n          __typename\n          type\n        }\n      }\n    }\n  }\n": typeof types.PagesDocument,
};
const documents: Documents = {
    "\n  query Homepage {\n    homepage {\n      seo {\n        metaTitle\n        metaDescription\n        shareImage {\n          url\n        }\n      }\n      blocks {\n        ... on ComponentSharedRichText {\n          __typename\n          body\n        }\n        ... on ComponentSharedMedia {\n          __typename\n          file {\n            url\n            alternativeText\n          }\n          width\n          height\n          rotation\n          border\n          adornments {\n            media {\n              file {\n                url\n                alternativeText\n              }\n              left\n              top\n              bottom\n              right\n              width\n              height\n              rotation\n            }\n          }\n        }\n        ... on ComponentSharedSpecialComponent {\n          __typename\n          type\n        }\n      }\n    }\n  }\n": types.HomepageDocument,
    "\n  query Site {\n    sidebar {\n      topImage {\n        url\n        alternativeText\n      }\n      categories {\n        categoryTitle\n        backgroundImage {\n          url\n        }\n        items {\n          text\n          page {\n            slug\n          }\n        }\n      }\n      links {\n        service\n        url\n      }\n      listAdornments {\n        media {\n          file {\n            url\n          }\n        }\n      }\n    }\n    site {\n      backgroundColor\n    }\n  }\n": types.SiteDocument,
    "\n  query Pages {\n    pages(pagination: { pageSize: 100 }) {\n      slug\n      seo {\n        metaTitle\n        metaDescription\n        shareImage {\n          url\n        }\n      }\n      blocks {\n        ... on ComponentSharedRichText {\n          __typename\n          body\n        }\n        ... on ComponentSharedMedia {\n          __typename\n          file {\n            url\n            alternativeText\n          }\n          width\n          height\n          rotation\n          border\n          adornments {\n            media {\n              file {\n                url\n                alternativeText\n              }\n              left\n              top\n              bottom\n              right\n              width\n              height\n              rotation\n            }\n          }\n        }\n        ... on ComponentSharedSpecialComponent {\n          __typename\n          type\n        }\n      }\n    }\n  }\n": types.PagesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Homepage {\n    homepage {\n      seo {\n        metaTitle\n        metaDescription\n        shareImage {\n          url\n        }\n      }\n      blocks {\n        ... on ComponentSharedRichText {\n          __typename\n          body\n        }\n        ... on ComponentSharedMedia {\n          __typename\n          file {\n            url\n            alternativeText\n          }\n          width\n          height\n          rotation\n          border\n          adornments {\n            media {\n              file {\n                url\n                alternativeText\n              }\n              left\n              top\n              bottom\n              right\n              width\n              height\n              rotation\n            }\n          }\n        }\n        ... on ComponentSharedSpecialComponent {\n          __typename\n          type\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').HomepageDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Site {\n    sidebar {\n      topImage {\n        url\n        alternativeText\n      }\n      categories {\n        categoryTitle\n        backgroundImage {\n          url\n        }\n        items {\n          text\n          page {\n            slug\n          }\n        }\n      }\n      links {\n        service\n        url\n      }\n      listAdornments {\n        media {\n          file {\n            url\n          }\n        }\n      }\n    }\n    site {\n      backgroundColor\n    }\n  }\n"): typeof import('./graphql').SiteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Pages {\n    pages(pagination: { pageSize: 100 }) {\n      slug\n      seo {\n        metaTitle\n        metaDescription\n        shareImage {\n          url\n        }\n      }\n      blocks {\n        ... on ComponentSharedRichText {\n          __typename\n          body\n        }\n        ... on ComponentSharedMedia {\n          __typename\n          file {\n            url\n            alternativeText\n          }\n          width\n          height\n          rotation\n          border\n          adornments {\n            media {\n              file {\n                url\n                alternativeText\n              }\n              left\n              top\n              bottom\n              right\n              width\n              height\n              rotation\n            }\n          }\n        }\n        ... on ComponentSharedSpecialComponent {\n          __typename\n          type\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').PagesDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
