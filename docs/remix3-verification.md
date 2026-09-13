# Local verification — 2026-09-05

This is a historical verification record. On 2026-09-13, `remix3-tea` moved
into the primary `andrew-gosse-site` checkout and the separate worktree was
retired. See the README for current paths; the paths below describe the setup
at the time of these checks.

Implementation worktree: `/home/jack/repos/personal/andrew-gosse-remix3`, branch
`remix3-tea`. Reference: `/home/jack/repos/personal/andrew-gosse-site`, `tea-cms`.
Production was not changed. The original checkout still has only its pre-existing
untracked `PLAN.md`; its code and fixture were not rewritten.

## Migration checks (before the CMS workflow update)

- `npm test`: 8 passing server tests covering migrations, persistence and stale
  writes, auth lifecycle, request protection, block validation/sanitization, media
  confinement, missing files, MIME headers, range responses, and forged uploads.
- `npm run test:browser`: 5 passing real-Chromium scenarios, also repeated through
  a separate Tailscale HTTPS route. Covers page editing/public round trips, uploads,
  alternative text, removal, navigation, adornments, settings, formatting, previews,
  conflicting tabs, title-only draft recovery, reorder/undo/redo, history access,
  and desktop/mobile rendering. Tests use independent fixtures and test-only users.
- `npm run build`: TypeScript checks and production compilation of 53 browser
  modules. `npm audit`: zero reported vulnerabilities at verification time.
- `tea:parity`: all eight original tables exactly match, including 21 pages,
  1 homepage, 73 media records, 13 adornments, 1 user, and 3 sessions. All 73 upload
  hashes match, totaling 15,465,068 bytes.
- `tea:import` into a fresh scratch directory and `tea:verify-import`: page/block
  content, navigation, site, adornments, and media bytes match the Tea reference,
  allowing newly generated IDs. Existing data cannot be overwritten by the importer.
- `tea:verify-preview`: all 95 homepage/page/media responses succeed; anonymous
  admin access redirects; all 22 stored documents pass editor validation.
- `docker build`: succeeds; the resulting production image runs as `node` with an
  independent mounted fixture. Login and all 95 public/media responses succeed.
  Restart retains the mounted content. Temporary smoke containers are stopped.

## CMS workflow update

- `npm test`: 12 passing server tests, including draft isolation, explicit publish,
  stale draft rejection, homepage drafts, draft reference protection, nested folders,
  cycle/nonempty-delete protection, and TipTap format round trips.
- `npm run test:browser`: 12 passing Chromium scenarios on independent fixtures.
  Covers live unsaved preview, new-page privacy, publish, pointer/keyboard block
  reordering, folder/subfolder creation, file notes/moves, visual adornment editing,
  per-image draft placement, and light-only desktop/mobile screens.
- `npm run build`: typecheck and production compilation of 102 browser modules.
- Public smoke check: 95 routes/media succeed; all 22 documents validate.
- All 22 existing public block documents render identically to the earlier renderer.
- Compared with `tmp/editor-upgrade-before/data`: all original tables, preferences,
  history, and all 73 upload hashes are unchanged. Four existing sessions remain.
  The migration adds draft/folder tables without populating or rewriting content.
- TipTap uses its [framework-free integration](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript),
  with a stable opaque DOM leaf so Remix updates do not remove the editor DOM.

## Resizable preview and image fidelity

- Build passes; 13 server tests and 14 Chromium scenarios pass.
- The image canvas and full preview agree on computed photo/group sizes, tilt,
  borders and adornment placement, with and without adornments. Pointer movement
  is tested after rotation and scaling; styling survives draft save/reload.
- Pointer and keyboard resizing, the 390px mobile preset, wide desktop preview,
  sidebar collapse, preference persistence and narrow-pane container queries pass.
- All 22 existing public block documents still render identically. Compared with
  `tmp/resizable-preview-before/data`, every content/draft/metadata table and all
  73 upload hashes are unchanged. No production deployment was performed.
- Screenshots: `tmp/preview-image-parity.png` and `tmp/preview-wide-workspace.png`.

## Handoff

The intended private preview remains at
`https://newport.hedgehog-python.ts.net:8450/`; use `/tea/admin` and the existing
TeaCMS login. The test-only HTTPS route is removed after verification. Screenshots
are retained under ignored `tmp/cms-*.png` and `tmp/remix-homepage.png`.

The editor follows the generated Remix skill's native client-entry/Handle model;
there is no React adapter. Controls remain inert until initial hydration completes.
Page/homepage edits now autosave into private drafts; Publish changes the public
record. New pages remain private until published. TipTap 3 handles rich text inside
a DOM-owned leaf; the domain blocks use Remix. Other settings use explicit save
actions. Media folders and notes live in separate tables; placement overrides live
in the image block draft. Browser coverage is Chromium, not a cross-browser audit. The earlier HTTPS and
container checks above cover the migration baseline, not this subsequent UI update.

See [rollout and rollback](remix3-rollout.md) for the separate production approval
boundary, fresh backup/import requirements, and preservation of post-cutover edits.
