import { createRouter, type MiddlewareContext } from "remix/router";
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { cop } from "remix/middleware/cop";
import { assets } from "./assets.ts";
import { routes } from "./routes.ts";
import { ContentStore } from "./data/content.ts";
import { AuthStore } from "./data/auth.ts";
import { services, protectWrites } from "./middleware/context.ts";
import { headRequests } from "./middleware/head.ts";
import type { TeaDatabase } from "./data/database.ts";
import controller from "./actions/controller.tsx";
import authController from "./actions/auth/controller.tsx";
import adminController from "./actions/admin/controller.tsx";

const renderMiddleware = render({ assets });
export type AppContext = MiddlewareContext<
  [ReturnType<typeof services>, typeof renderMiddleware]
>;
declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}
export function createTeaRouter(database: TeaDatabase) {
  const content = new ContentStore(database.sqlite),
    auth = new AuthStore(database.sqlite);
  const router = createRouter<AppContext>({
    middleware: [
      headRequests,
      protectWrites,
      staticFiles("./public", { index: false }),
      cop({
        trustedOrigins: process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : [],
      }),
      services(content, auth),
      renderMiddleware,
    ],
  });
  router.map(routes, controller);
  router.map(routes.auth, authController);
  router.map(routes.admin, adminController);
  return router;
}
