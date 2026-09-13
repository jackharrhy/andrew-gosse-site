# TeaCMS theme and copy

Scope: `/tea/login` and `/tea/admin`. Public CSS, page rendering, stored content,
media, and site settings are separate. Do not apply CMS colors to Andrew's work.

## Palette

All interface colors live in `public/admin.css` as semantic OKLCH tokens. English
Breakfast browns cover the canvas, surfaces, text, and borders. Matcha is the only
interaction accent. Red-brown is reserved for errors and removal actions.

The CMS is light-only, even with a dark system preference: near-white paper,
faint tea surfaces, brown text, and small matcha accents. Form fields, dialogs, selections, and focus states share
the same tokens. Imported images, authored text colors, and the public preview
keep their original colors.

References:

- Sanzo Wada's [A Dictionary of Color Combinations](https://en.seigensha.com/books/978-4-86152-247-5/),
  published by Seigensha, for restrained combinations of a few colors.
- [Riso ink samples](https://www.stencil.wiki/wiki/Colors), particularly Brown,
  Moss, and Light Lime, for flat ink colors and lighter tints.

This is an original screen palette, not an exact Wada plate or a print-color proof.
Its matcha and brown values are adjusted for interface contrast.

## Copy and layout

Keep labels specific: "Sign in", "Edit homepage", "Select a file". Remove slogans,
decorative section numbers, and explanations that repeat the heading. Keep useful
limits, recovery instructions, save status, and deletion warnings. Do not rewrite
stored titles, descriptions, alternative text, or page blocks during a copy pass.

The humanizer pass removed promotional phrasing and forced metaphors. The
design-taste-frontend audit informed palette consistency, spacing, and copy cuts;
its landing-page layouts and framework defaults do not apply to this native Remix
admin. Public route paths and authored content stay stable.

The editing workflow uses tighter spacing, left-side drag handles, quiet panels,
and native dialogs. Adornments are positioned over real images with pointer or
keyboard controls, size and angle sliders; CSS fields are tucked under Advanced.
Media folders are logical groups, with subfolders and private descriptions; moving
a file never changes its public URL. Page previews update after a short typing
pause. Autosave saves a private draft; Publish is a separate, explicit action.

The workspace divider supports pointer dragging, arrow keys, Home/End, and Mobile
and Wide presets. Navigation can be hidden independently. Preferences stay in this
browser, not in page content. The full-page iframe renders at its actual pixel width.
The editor uses [container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)
for compact controls based on the editor pane; it stacks only when the entire workspace is too narrow.

Photo tilt, borders, layout and adornment styles share `app/ui/public/image-layout.ts`
with the public renderer. The canvas uses the preview article's width and font size,
scaled down to fit; drag coordinates account for both scale and image rotation.
Library photo-styling controls are preview-only; page image styling saves in the draft.

Design variance 4, motion 2, density 7. System sans-serif, 4px control corners,
6px panel corners. Use hover/focus/press feedback, without automatic animation.

## Checks

`test/theme.spec.ts` checks OKLCH-only CSS, copy regressions, light-only colors under both system preferences, palette
contrast, and mobile overflow across every CMS screen. It also exercises the
media inspector and image dialog. Screenshots are written to `tmp/tea-*.png`.
The editing suite verifies save/reload, recovery, uploads, and settings against
an isolated fixture. Runtime data is not modified by either suite.
