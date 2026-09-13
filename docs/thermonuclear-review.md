# TeaCMS review — 5 September 2026

Scope: the active Remix rewrite: routing, rendering, authentication, persistence,
validation, browser editors, assets/styles, migrations/import tools, tests, CI,
container configuration and rollout documentation. The preserved Astro checkout
is a reference, not an additional app being maintained or deployed by this pass.

## Verdict

The feature direction was sound, but the implementation was accumulating
structural debt. The most important problems were ownership and identity:
one editor owned every interaction, adornment names doubled as placement IDs,
and preview updates destroyed the document they were meant to update.

This pass fixes those problems and the concrete integrity/security issues below.
It is a local implementation review, not production deployment approval or a
claim that the application is free of defects.

## Findings and resolutions

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | The 779-line editor mixed preview networking, image controls, ordering, persistence and page UI; the 2,586-line stylesheet accumulated successive redesign overrides. | Dedicated LivePreview, ImageFields and BlockList owners. Removed custom Frame protocol code in favor of Remix defaults. Consolidated CSS into core, block/editor, library and viewport owners, with responsive rules after their base rules. No runtime source or stylesheet exceeds 1,000 lines; a regression check enforces the limit. |
| P1 | Library names were used as placement identity. Removing or moving one copy would affect every copy of the same artwork. | One canonical parser distinguishes artwork names from placement IDs. Add and Duplicate create independent IDs; Remove targets one instance. Legacy IDs are derived in memory without rewriting stored content. Validation, rendering and usage scanning share this model. |
| P1 | Every preview update assigned iframe.srcdoc, resetting the document and losing image/embed/scroll state. | Initialize one sandboxed iframe, then reconcile server-rendered HTML in place. Preview-only block keys retain matching nodes. Fetches are debounced and superseded requests cancelled. Tests assert document and image identity and zero load events after typing/resizing. |
| P1 | History and some mutations were separate writes. Revision checks occurred before obtaining the write lock. Shared artwork had no stale-write protection. | A synchronous transaction boundary owns checks and writes for pages/drafts, navigation/settings, folders/details, shared adornments and media removal. Shared adornments carry content revisions. A forced failure test proves deletion rolls back both content and history. |
| P1 | Loose request/context contracts allowed malformed values through ad-hoc validation. Save responses could discard edits made while a request was in flight. | Typed application context; unknown request values validated before use; schemas for navigation/settings/artwork; explicit folder types. Navigation/settings/media preserve newer local edits. Async removal captures the target before awaiting and handles errors. |
| P1 | Login throttling counted failures only after asynchronous password checks, permitting concurrent bypass, with unbounded key growth. | Attempts are reserved before hashing, with bounded concurrent checks and bounded key storage. Regression coverage exercises concurrent attempts. |
| P1 | Parity failures could print full user/session rows. Imports could skip missing files and report success with missing media. Some Markdown conversions silently lost structure. | Parity failures now report only a safe summary. Imports fail on missing source files, use the canonical migration runner and a content transaction, and require stronger account passwords. Complex lists and inline images use a lossless Markdown fallback; heading levels are retained. |
| P2 | The preview sat beneath application/page headers; shrinking it still left too much outer UI. | Page controls live in the independently scrolling left pane. The right iframe and splitter occupy the entire viewport height. Navigation collapses; the editor collapses to a 48px rail. Presets and keyboard resizing remain available. Mobile navigation has a reachable close button. |
| P2 | Media usage checks rebuilt and scanned the content collection once per file and matched arbitrary ID substrings. | Build the media usage index once per library request. A shared walker tracks exact IDs, nested blocks and local image URLs in Markdown. Folder paths also have one shared implementation. |
| P2 | Browser verification depended on a private working database and did not run in CI. | A synthetic fixture now supports the complete browser suite. An explicit E2E_FIXTURE_DIR option backs up real content for additional verification. CI installs Chromium and runs the browser suite. |

The preview uses the existing server renderer, not a second implementation of the
website. DOM reconciliation uses the small, pinned
[morphdom ESM implementation](https://github.com/patrick-steele-idem/morphdom);
it is isolated to LivePreview. Photo/group/adornment CSS remains shared with the
published renderer.

## Deliberate boundaries and remaining work

- Production is unchanged. Remix is pinned to a release candidate. Re-check
  framework/security status, rehearse a fresh production import and restore, and
  approve the service/router cutover separately. The rollout document remains the
  deployment authority; this review does not authorize that step.
- Browser coverage is Chromium. Safari/Firefox, touch-device behavior and a
  screen-reader pass still belong in release acceptance.
- The preview is visually faithful but sandboxed without scripts. It deliberately
  does not execute arbitrary embedded scripts. Changed or removed embeds may
  necessarily recreate their own DOM; unchanged outer documents no longer flash.
- A draft based on a published record changed outside the draft workflow is
  protected from overwriting it. There is no merge/rebase UI for that exceptional
  case yet; the error now explains that reconciliation is required, not that
  reloading alone resolves it.
- Media descriptions and folder metadata remain last-writer-wins between tabs.
  Page, navigation, site and shared-adornment revisions are protected. Add
  metadata revisions before introducing a multi-editor asset-management workflow.
- Block properties deliberately retain an extensible payload for imported and
  unknown block types. This is not a promise that arbitrary new blocks can be
  edited: known fields are validated and unknown fields round-trip unchanged.
- History and retained upload bytes have no automatic retention policy. Define
  backup/retention requirements before adding any cleanup job; do not silently
  delete recoverable content.
- Login limits are process-local, matching the documented single-process SQLite
  deployment. Multi-process deployment needs shared rate limiting and coordination.
- The importer still targets this site's Strapi backup schema. Conversion tests
  are not a substitute for comparing a fresh production backup before cutover.

## Verification

The checks run on independent fixtures, not the working content. The audit
snapshot is tmp/thermonuclear-before/data.

- Typecheck and production compilation of 133 browser modules passed. The
  production dependency audit reported zero known vulnerabilities.
- 19 server tests passed: validation, rendering, drafts/publishing/stale writes, atomic
  rollback, shared-artwork conflicts, auth limits, media safety, folders and import
  conversion.
- 18 browser checks passed against an independent copy of real content; the
  synthetic fixture also passes the CMS suite and mobile-navigation check.
  Coverage includes complete CMS flows, geometry parity, duplicate placements,
  full-height resizing/collapse, non-reloading preview, light-theme contrast,
  mobile overflow and the source-size guard.
- Working data comparison: all 14 tables and 73 upload files unchanged.
- Public renderer comparison: all 22 documents identical to the pre-redesign
  renderer, including image/adornment styles.
- Public endpoint sweep: 95 successful page/media responses; all 22 stored
  documents validate; anonymous CMS access remains protected.
- Rehearsed the updated importer into tmp/thermonuclear-import from the preserved
  local Strapi backup: 21 pages, 73 files and 13 adornments imported successfully.
  The content/reference/byte comparison against the Tea fixture passed.

Commands and the optional real-content run are documented in README.md.
