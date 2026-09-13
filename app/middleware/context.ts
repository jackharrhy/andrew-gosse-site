import { createContextKey, type Middleware } from "remix/router";
import type { ContentStore } from "../data/content.ts";
import type { AuthStore, User } from "../data/auth.ts";
import { sessionId } from "../data/auth.ts";

export const contentContext = createContextKey<ContentStore>();
export const authContext = createContextKey<AuthStore>();
export const userContext = createContextKey<User | null>();
export function services(
  content: ContentStore,
  auth: AuthStore,
): Middleware<
  readonly [
    { key: typeof contentContext; value: ContentStore },
    { key: typeof authContext; value: AuthStore },
    { key: typeof userContext; value: User | null },
  ]
> {
  return (context, next) => {
    context.set(contentContext, content);
    context.set(authContext, auth);
    context.set(userContext, auth.resolve(sessionId(context.request)));
    return next();
  };
}
export const requireEditor: Middleware = (context, next) => {
  if (!context.get(userContext)) {
    if (context.request.method !== "GET")
      return Response.json(
        {
          error:
            "Your session expired. Sign in again; keep this tab open to preserve your edits.",
        },
        { status: 401 },
      );
    return new Response(null, {
      status: 303,
      headers: { Location: "/tea/login" },
    });
  }
  return next();
};
export const protectWrites: Middleware = async (context, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
    const origin = context.request.headers.get("origin");
    const allowed = new Set(
      [context.url.origin, process.env.APP_ORIGIN].filter(Boolean),
    );
    if (!origin || !allowed.has(origin))
      return Response.json(
        { error: "This request must come from the CMS." },
        { status: 403 },
      );
    const size = Number(context.request.headers.get("content-length") ?? 0);
    if (size > 26 * 1024 * 1024)
      return Response.json(
        { error: "Uploads must be smaller than 25 MB." },
        { status: 413 },
      );
  }
  const response = await next();
  if (response) {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (
      context.url.pathname.startsWith("/tea/") &&
      !context.url.pathname.startsWith("/tea/api/media/file/")
    ) {
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set("X-Frame-Options", "SAMEORIGIN");
    }
  }
  return response;
};
