import type { APIRoute } from "astro";
import {
  listPages,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage,
} from "../../../../tea/api/pages.js";

export const prerender = false;

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = ({ params }) => {
  const slug = params.path;
  if (!slug) return listPages();
  return getPageBySlug(slug);
};

export const POST: APIRoute = ({ params, request }) => {
  if (params.path) return notFound();
  return createPage(request);
};

export const PUT: APIRoute = ({ params, request }) => {
  const slug = params.path;
  if (!slug) return notFound();
  return updatePage(slug, request);
};

export const DELETE: APIRoute = ({ params }) => {
  const slug = params.path;
  if (!slug) return notFound();
  return deletePage(slug);
};
