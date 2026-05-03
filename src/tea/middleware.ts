import { defineMiddleware } from "astro:middleware";
import { getSessionIdFromRequest, validateSession } from "./auth.js";

const ADMIN_PREFIX = "/_tea/admin";
const LOGIN_PATH = "/_tea/admin/login";
const PUBLIC_API_PATHS = [
  "/_tea/api/auth/login",
  "/_tea/api/auth/me",
  "/_tea/api/media/file",
];

function isProtectedAdmin(pathname: string): boolean {
  if (!pathname.startsWith(ADMIN_PREFIX)) return false;
  return pathname !== LOGIN_PATH;
}

function isProtectedApi(pathname: string): boolean {
  if (!pathname.startsWith("/_tea/api")) return false;
  return !PUBLIC_API_PATHS.some((p) => pathname.startsWith(p));
}

export const teaMiddleware = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const isAdmin = isProtectedAdmin(url.pathname);
  const isApi = isProtectedApi(url.pathname);

  if (!isAdmin && !isApi) return next();

  const sessionId = getSessionIdFromRequest(context.request);
  const user = sessionId ? validateSession(sessionId) : null;

  if (!user) {
    if (isAdmin) {
      return context.redirect(LOGIN_PATH);
    }
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  context.locals.user = user;
  return next();
});
