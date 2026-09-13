import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { createTeaRouter } from "./app/router.ts";
import { openDatabase } from "./app/data/database.ts";
import { assets } from "./app/assets.ts";

const database = await openDatabase();
const router = createTeaRouter(database);

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 4331;
const host = process.env.HOST ?? "127.0.0.1";
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? Number.parseInt(process.env.HMR_PROXY_PORT, 10)
  : null;

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request);
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error);
      }
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
);

server.listen(port, host, () => {
  if (process.env.REMIX_NODE_HMR) {
    import("remix/node-hmr/runtime").then((nodeHmr) =>
      nodeHmr.emitServerReady(),
    );
  }

  console.log(`Server listening on http://${host}:${hmrProxyPort ?? port}`);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  server.close(async () => {
    await assets.close();
    database.sqlite.close();
    process.exit(0);
  });
  server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
