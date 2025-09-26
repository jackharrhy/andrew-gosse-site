export const strapiUrl =
  import.meta.env.STRAPI_URL ??
  process.env.STRAPI_URL ??
  "http://localhost:1337";

export const externalStrapiUrl =
  import.meta.env.EXTERNAL_STRAPI_URL ??
  process.env.EXTERNAL_STRAPI_URL ??
  strapiUrl;
