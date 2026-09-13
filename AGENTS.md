# TeaCMS Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run dev
npm run start
npm test
npm run typecheck
```

## Building Features

Refer to ./.agents/skills/remix/SKILL.md

## Application Layout

- `app/actions/controller.tsx` owns the top-level route actions
- `app/actions/public-page.tsx` renders public pages; `app/ui/document.tsx` owns the document shell
- `app/actions/public/` contains the browser runtime entry and public assets
- `app/actions/admin/` owns the CMS controllers, screens, and native editor
- `app/data/` owns persistence, content operations, and authentication
- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs
- `app/router.ts` wires routes to route handlers and installs the standard Remix UI renderer used by actions
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and render middleware
- Root `public/` contains static files served unchanged from the app root

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` for nested route maps that need their own actions or middleware.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## Build-Out Notes

- The primary checkout is `/home/jack/repos/personal/andrew-gosse-site` on `remix3-tea`. The separate Remix worktree has been retired. The earlier implementation remains on `tea-cms`, with its local files in a sibling `andrew-gosse-pre-remix-20260913-*` backup. Do not write to that backup or production.
- Runtime data lives in ignored `data/` (override with `TEA_DATA_DIR`); migrations live in `db/migrations/`.
- Use `npm run build`, `npm test`, and `npm run test:browser` for verification. Browser tests create an independent temporary copy of the fixture.
- Local servers bind to loopback. Only scoped Tailscale Serve routes may expose previews.
- The CMS uses Remix UI directly, including its site-specific block editor. Preserve unknown block data and reject stale writes.

- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
