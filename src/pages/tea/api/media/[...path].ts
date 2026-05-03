import type { APIRoute } from "astro";
import {
  listMedia,
  uploadMedia,
  updateMedia,
  deleteMedia,
  serveMediaFile,
} from "../../../../tea/api/media.js";

export const prerender = false;

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = ({ params }) => {
  const path = params.path ?? "";
  if (!path) return listMedia();
  const parts = path.split("/");
  if (parts[0] === "file" && parts[1]) return serveMediaFile(parts[1]);
  return notFound();
};

export const POST: APIRoute = ({ params, request }) => {
  if (params.path) return notFound();
  return uploadMedia(request);
};

export const PUT: APIRoute = ({ params, request }) => {
  const id = params.path;
  if (!id) return notFound();
  return updateMedia(id, request);
};

export const DELETE: APIRoute = ({ params }) => {
  const id = params.path;
  if (!id) return notFound();
  return deleteMedia(id);
};
