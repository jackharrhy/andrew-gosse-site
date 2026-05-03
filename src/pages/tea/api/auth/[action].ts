import type { APIRoute } from "astro";
import { postLogin, postLogout, getMe } from "../../../../tea/api/auth.js";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const action = params.action;
  if (action === "login") return postLogin(request);
  if (action === "logout") return postLogout(request);
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = ({ params, request }) => {
  if (params.action === "me") return getMe(request);
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};
