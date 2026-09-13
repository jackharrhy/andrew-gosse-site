# Design: Bespoke Page Editor

**Date:** 2026-04-05
**Status:** Approved

## Problem

EmDash's Block Kit dialog system is inadequate for editing pages — every block edit requires opening a modal, media blocks have 13 fields in a flat dialog, and rich text has no preview. A non-dev user cannot comfortably edit page content this way.

## Approach

A bespoke React admin page registered in the `content-blocks` plugin at `/page-editor`. All block editing is inline — no dialogs. Rich text gets a split markdown/preview panel. Media blocks show an image picker always and collapse layout fields behind a toggle. The standard EmDash page/homepage editor's `blocks` field is replaced with a redirect widget pointing to this editor.

## Architecture

```
plugins/content-blocks/src/
  index.ts                          MODIFY — add /page-editor to adminPages + fieldWidgets
  admin.tsx                         MODIFY — export PageEditor page + BlocksFieldRedirect field
  components/
    PageEditor.tsx                  NEW — top-level page: load/save/state
    BlockList.tsx                   NEW — ordered block list, add/remove/reorder, type dispatch
    BlocksFieldRedirect.tsx         NEW — redirect widget for pages.blocks + homepage.blocks
    blocks/
      RichTextBlock.tsx             NEW — split markdown textarea + live HTML preview
      MediaBlock.tsx                NEW — image picker + collapsed layout fields + adornments
      SpecialComponentBlock.tsx     NEW — single select for type
```

**No new plugin.** All additions go into the existing `content-blocks` plugin.

## Plugin Descriptor Changes

```typescript
// index.ts — contentBlocksPlugin() descriptor
adminPages: [
  { path: "/sidebar", label: "Sidebar", icon: "link" },
  { path: "/page-editor", label: "Page Editor", icon: "link" },
]

// index.ts — createPlugin() admin block
fieldWidgets: [
  { name: "colorPicker",    label: "Color Picker",    fieldTypes: ["string"] },
  { name: "sidebarField",   label: "Sidebar Field",   fieldTypes: ["json"]   },
  { name: "blocksField",    label: "Blocks Field",    fieldTypes: ["portableText"] },
]

// admin.tsx exports
export const pages = {
  "/sidebar":     SidebarEditor,
  "/page-editor": PageEditor,
};
export const fields = {
  colorPicker:  ColorPicker,
  sidebarField: SidebarFieldRedirect,
  blocksField:  BlocksFieldRedirect,
};
```

## `BlocksFieldRedirect` Widget

Registered as `content-blocks:blocksField`. Applied to:
- `pages.blocks` field
- `homepage.blocks` field

Both set via direct SQLite update on `_emdash_fields`:
```sql
UPDATE _emdash_fields SET widget = 'content-blocks:blocksField'
WHERE slug = 'blocks'
AND collection_id IN (
  SELECT id FROM _emdash_collections WHERE slug IN ('pages', 'homepage')
);
```

**Entry ID detection:** The widget reads `window.location.pathname`. EmDash's standard editor URLs are:
- `/_emdash/admin/content/pages/<id>`
- `/_emdash/admin/content/homepage/<id>`

The collection is the second-to-last path segment, the ID is the last segment.

**Rendered output:**
```
Blocks
[ Edit in Page Editor → ]
This field is managed through the Page Editor.
```

Link: `/_emdash/admin/plugins/content-blocks/page-editor?id=<id>&collection=<collection>`

## `PageEditor.tsx`

**Route:** `/_emdash/admin/plugins/content-blocks/page-editor?id=<id>&collection=<collection>`

**Fallback (no id param):** Renders a list of all pages via `fetchContentList("pages")` with a link to the editor for each. Also links to the homepage entry.

### Loading

```typescript
const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const collection = params.get("collection") ?? "pages"; // "pages" | "homepage"
const item = await fetchContent(collection, id);
```

Extract from `item.data`:
- `blocks: Block[]` — working state
- Keep a reference to full `item.data` for spread on save

### State

```typescript
interface PageEditorState {
  id: string;
  collection: "pages" | "homepage";
  title: string;          // display only, not edited here
  blocks: Block[];
  originalData: Record<string, unknown>; // full item.data, preserved on save
}
```

### Saving

```typescript
await updateContent(collection, id, {
  data: { ...originalData, blocks }
});
await publishContent(collection, id);
```

`originalData` is spread first so `title`, `page_slug`, `seo` etc. are never lost.

### UI

```
← Back to [title]          [Save & Publish]    ← sticky top bar

[BlockList]

[Save & Publish]           ← bottom bar
```

"Back" link: `/_emdash/admin/content/<collection>/<id>`

## `BlockList.tsx`

```typescript
interface BlockListProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}
```

Each block row:
```
[↑] [↓]  [block editor — full width]  [×]
```

Up/down buttons disabled at boundaries (same as `Repeater`). Remove button on the right.

**Add block menu** — inline dropdown below the list, not a modal:
```
[+ Add block ▾]
  ├── Rich Text
  ├── Media  
  └── Special Component
```

Default values for new blocks:
- `richText` → `{ _type: "richText", body: "" }`
- `media` → `{ _type: "media", file: { url: "", alt: null } }`
- `specialComponent` → `{ _type: "specialComponent", type: "riso_colors" }`

**Block dispatch:**
```typescript
switch (block._type) {
  case "richText":        return <RichTextBlock block={block} onChange={update} />;
  case "media":           return <MediaBlock block={block} onChange={update} />;
  case "specialComponent":return <SpecialComponentBlock block={block} onChange={update} />;
}
```

Each block editor receives its typed block and an `onChange(block)` callback. Changes flow up to `PageEditor` state immediately; nothing is saved to the API until "Save & Publish".

## Block Editor Components

### `RichTextBlock.tsx`

```typescript
interface RichTextBlockProps {
  block: RichTextBlock;
  onChange: (block: RichTextBlock) => void;
}
```

**Layout:** Two equal-width panels side by side (CSS grid, `1fr 1fr`). On narrow viewports (< 768px) stacks vertically.

**Left panel — markdown textarea:**
- `<textarea>` with `font-family: monospace`, auto-resize via `scrollHeight`
- `min-height: 8rem`, grows to fit content
- Updates `block.body` on every `onChange` event

**Right panel — live preview:**
- `<div>` with `set:html` equivalent: `dangerouslySetInnerHTML={{ __html: marked.parse(block.body) }}`
- Styled with Tailwind prose classes: `prose prose-sm max-w-none`
- Updates on every keystroke

### `MediaBlock.tsx`

```typescript
interface MediaBlockProps {
  block: MediaBlock;
  onChange: (block: MediaBlock) => void;
}
```

**Always visible:**
- `ImagePicker` (existing component) for `block.file`
- Small thumbnail preview (handled by `ImagePicker` itself)

**"Advanced layout ▾" toggle** (local `useState(false)`):

When expanded, shows two sections:

*Dimensions & spacing (2×2 grid):*
| Width | Height |
| Padding | Margin |

*Position (2×2 grid):*
| Top | Right |
| Bottom | Left |

*Then single-column:*
- Rotation (number input, degrees)
- Border (text input)
- Filter (text input, e.g. `grayscale(100%)`)

*Adornments section* (inside the toggle, below layout fields):
- Uses `Repeater<AdornmentBlock>` (existing component)
- Each adornment's `renderItem` renders inline (no separate component file): `ImagePicker` for the file, then the same layout fields (top/right/bottom/left, width/height, padding/margin, rotation, border, filter) as plain inputs — no nested toggle, just all shown since the parent toggle already gates visibility
- Add label: "+ Add adornment"

All fields call `onChange({ ...block, fieldName: value })` on change.

### `SpecialComponentBlock.tsx`

```typescript
interface SpecialComponentBlockProps {
  block: SpecialComponentBlock;
  onChange: (block: SpecialComponentBlock) => void;
}
```

A single `<select>` with one `<option value="riso_colors">Riso Colors</option>`. Calls `onChange({ ...block, type: e.target.value })`.

## DB Wiring

After deploying, run via sqlite3:
```sql
-- Wire blocksField widget to pages.blocks and homepage.blocks
UPDATE _emdash_fields SET widget = 'content-blocks:blocksField'
WHERE slug = 'blocks'
AND collection_id IN (
  SELECT id FROM _emdash_collections WHERE slug IN ('pages', 'homepage')
);
```

## Dependencies

No new npm packages. Uses:
- `react` (already installed)
- `@emdash-cms/admin` — `fetchContent`, `fetchContentList`, `updateContent`, `publishContent`, `MediaPickerModal`
- `marked` — already installed, used for the live preview
- Existing plugin components: `ImagePicker`, `Repeater`

## Out of Scope

- Editing `title`, `page_slug`, or `seo` fields (those remain on the standard EmDash editor)
- Drag-and-drop reordering (up/down arrows sufficient)
- Autosave
- Undo/redo within a session
- Creating new pages (use the standard EmDash "+ New" flow, then open in Page Editor)
