import type { APIRoute } from "astro";
import {
  listAdornments,
  createAdornment,
  updateAdornment,
  deleteAdornment,
} from "../../../../tea/api/adornments.js";

export const prerender = false;

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = ({ params }) => {
  if (params.path) return notFound();
  return listAdornments();
};

export const POST: APIRoute = ({ params, request }) => {
  if (params.path) return notFound();
  return createAdornment(request);
};

export const PUT: APIRoute = ({ params, request }) => {
  const id = params.path;
  if (!id) return notFound();
  return updateAdornment(id, request);
};

export const DELETE: APIRoute = ({ params }) => {
  const id = params.path;
  if (!id) return notFound();
  return deleteAdornment(id);
};
