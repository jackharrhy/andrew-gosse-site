# Design: Sidebar Editor & Color Picker Plugin Admin UI

**Date:** 2026-04-04
**Status:** Approved

## Problem

The EmDash admin renders `JSON` fields as empty plain text inputs — it has no way to display or edit complex nested objects. The `sidebar` collection's `top_image`, `categories`, and `links` fields are all JSON, so they appear blank. The `site` collection's `background_color` field works (plain string) but shows a text input with a hex value instead of a colour picker.

The site's non-dev editor needs to be able to:
- Change the sidebar's top profile image
- Edit category titles, background images, and nav items (add/remove/reorder)
- Edit social links (add/remove)
- Change the site background colour

## Approach

Extend the existing `content-blocks` plugin (`plugins/content-blocks/`) with:
1. A **custom React admin page** for the full sidebar editor
2. A **field widget** for the `background_color` colour picker

No new plugin is created. The existing plugin is native format and already has `adminEntry` capability.

## Architecture

```
plugins/content-blocks/
  src/
    index.ts                    MODIFY — add adminEntry, adminPages, fieldWidgets to descriptor
    admin.tsx                   NEW — exports { pages, fields }
    components/
      SidebarEditor.tsx         NEW — full sidebar editing page
      ImagePicker.tsx           NEW — MediaPickerModal wrapper
      Repeater.tsx              NEW — generic up/down/add/remove list
      ColorPicker.tsx           NEW — color input + hex text field widget
  package.json                  MODIFY — add "./admin" export
```

### Plugin descriptor changes (`index.ts`)

```typescript
export function contentBlocksPlugin(): PluginDescriptor {
  return {
    id: "content-blocks",
    version: "0.1.0",
    entrypoint: "@andrew-gosse-site/plugin-content-blocks",
    componentsEntry: "@andrew-gosse-site/plugin-content-blocks/astro",
    adminEntry: "@andrew-gosse-site/plugin-content-blocks/admin",
    adminPages: [{ path: "/sidebar", label: "Sidebar", icon: "link" }],
    options: {},
  };
}

export function createPlugin(): ResolvedPlugin {
  return definePlugin({
    id: "content-blocks",
    version: "0.1.0",
    capabilities: [],
    admin: {
      entry: "@andrew-gosse-site/plugin-content-blocks/admin",
      pages: [{ path: "/sidebar", label: "Sidebar", icon: "link" }],
      portableTextBlocks: [ /* existing — unchanged */ ],
      fieldWidgets: [
        { name: "colorPicker", label: "Color Picker", fieldTypes: ["string"] },
      ],
    },
  });
}
```

### `admin.tsx` exports

```typescript
export const pages = { "/sidebar": SidebarEditor };
export const fields = { colorPicker: ColorPicker };
```

### `package.json` export addition

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./astro": "./src/astro/index.ts",
    "./admin": "./src/admin.tsx"
  }
}
```

## Sidebar Editor Page

**Route:** `/_emdash/admin/plugins/content-blocks/sidebar`
**Linked from:** Admin nav under the plugin's registered pages

### Data loading

On mount, call `fetchContentList("sidebar")` from `@emdash-cms/admin` and take `result.items[0]`. The sidebar collection always has exactly one entry (slug `"sidebar"`). Copy `item.id` and `item.data` into local React state.

### State shape

```typescript
interface SidebarState {
  id: string;
  topImage: { url: string; alt: string } | null;
  categories: Array<{
    categoryTitle: string;
    backgroundImage: { url: string; alt: string } | null;
    items: Array<{ text: string; page: { slug: string } }>;
  }>;
  links: Array<{ service: string; url: string }>;
}
```

### Saving

On "Save & Publish":
1. `updateContent("sidebar", state.id, { data: { top_image: state.topImage, categories: state.categories, links: state.links } })`
2. `publishContent("sidebar", state.id)`

Both calls use functions imported directly from `@emdash-cms/admin`. No plugin routes needed — the editor talks directly to EmDash's content API.

Save button is disabled while saving. Shows spinner during save. Shows brief "Saved!" success state on completion. Shows error message on failure (with retry).

### UI layout

```
[ Save & Publish ]                              ← sticky top bar

Top Image
  [img preview or placeholder box]
  [Change image] [Remove]
  Alt text: [____________]

Categories
  ┌─────────────────────────────────────────┐
  │ [↑] [↓]  Category title: [____________] │  [× Remove category]
  │ Background image: [img] [Change] [Remove]│
  │ Nav items:                               │
  │   [Film Music] [film-music] [×]          │
  │   [Game Audio] [game-audio] [×]          │
  │   [+ Add item]                           │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ ... (next category)                      │
  └─────────────────────────────────────────┘
  [+ Add category]

Links
  [YouTube] [https://...] [×]
  [Instagram] [https://...] [×]
  [+ Add link]

[ Save & Publish ]                              ← bottom bar
```

### categoryTitle null fix

The migration stored `null` for all category titles (the Strapi `category_title` column was empty). The editor renders empty text inputs for these — the friend fills them in and saves. No data migration needed.

## Components

### `ImagePicker.tsx`

```typescript
interface ImagePickerProps {
  value: { url: string; alt: string } | null;
  onChange: (value: { url: string; alt: string } | null) => void;
  label: string;
}
```

- Renders a small `<img>` preview if value is set, otherwise a placeholder box
- "Change" button opens `MediaPickerModal` (from `@emdash-cms/admin`)
- "Remove" button clears the value
- On media select: maps `MediaItem` → `{ url: item.url, alt: item.filename }`

### `Repeater.tsx`

```typescript
interface RepeaterProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, update: (item: T) => void) => React.ReactNode;
  createItem: () => T;
  addLabel: string;
}
```

Handles: move-up, move-down (swaps adjacent items), remove (filters by index), add (appends `createItem()`). Used for the top-level categories list and the links list. Nav items within a category use a simpler inline version (no up/down — the list is short enough).

### `ColorPicker.tsx`

Field widget for `background_color`. Props match EmDash's field widget interface:
```typescript
interface FieldWidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  id: string;
  required?: boolean;
}
```

Renders: `<input type="color">` + hex text input side by side. Valid 6-digit hex stored as string. Modelled directly on `@emdash-cms/plugin-color` from the emdash monorepo.

## Wiring the Colour Picker to the `background_color` Field

After deploying the plugin changes, the admin schema builder must be used to set the `background_color` field's widget to `content-blocks:colorPicker`. This is a one-time manual step in the EmDash admin UI at `/_emdash/admin/content-types`.

## Dependencies

No new npm packages needed. All imports come from:
- `react` (already installed)
- `@emdash-cms/admin` (already installed — `fetchContent`, `updateContent`, `publishContent`, `MediaPickerModal`, `apiFetch`)
- `@emdash-cms/blocks` (already installed — `Element` type for field widget)

## Out of scope

- Drag-and-drop reordering (up/down arrows are sufficient)
- Inline editing of the sidebar preview (separate concern)
- Editing the `seo` JSON field on pages/homepage (not requested)
- Any changes to `Sidebar.astro` or `fetch-emdash.ts` (data shape is unchanged)
