# Design: Adornment Library

**Date:** 2026-04-05
**Status:** Approved

## Problem

The adornment system (decorative tape/line images overlaid on photos) is powerful but completely opaque to non-dev editors. Currently adornments are stored as raw inline CSS objects in each media block — 13 fields per adornment with no names. There is no way to browse or pick adornments by name; editing requires knowing that "top left blue tape" means `height: 2rem, top: -0.5rem, left: -1.5rem, rotation: -25, filter: hue-rotate(45deg)`.

## Solution

A named adornment library stored as an EmDash collection. Editors pick adornments by name from a visual thumbnail grid. Blocks store lightweight references (`{ _adornmentName: "top left blue tape" }`) instead of inline CSS. The renderer resolves references at render time via a synchronous SQLite lookup.

## Adornment Inventory (from Strapi backup)

13 named adornments in two categories:

**Decorative lines (3):**
- list style 1, 2, 3 — squiggly black lines, no CSS overrides

**Tape (10):** — all use `height: 2rem, rotation: -25`. Two positions × five colours:
- top left: aqua, blue, coral, purple tape
- bottom right: aqua, blue, coral, purple tape
- tape top left 1 (white tape, hue-rotate 112deg)
- bottom right tape 2 (white tape, no filter)

All tape variants are 1–2 base images with CSS `hue-rotate` filters for colour variations.

## Architecture

### New EmDash collection: `adornments`

Created via admin UI (schema builder). Fields:
- `name` — string, required, unique
- `file` — JSON (`{ url: string, alt: string }`)
- `width`, `height`, `padding`, `margin` — string
- `top`, `right`, `bottom`, `left` — string
- `rotation` — number (degrees)
- `border` — string
- `filter` — string (CSS filter, e.g. `hue-rotate(45deg)`)

### Storage shape in blocks

**Before:**
```json
{
  "adornments": [{
    "file": { "url": "/_emdash/api/media/file/...", "alt": "piece of tape" },
    "height": "2rem",
    "top": "-0.5rem",
    "left": "-1.5rem",
    "rotation": -25,
    "filter": "hue-rotate(45deg)"
  }]
}
```

**After:**
```json
{
  "adornments": [{ "_adornmentName": "top left blue tape" }]
}
```

### Files changed

| Area | File | Change |
|---|---|---|
| Plugin | `src/index.ts` | Add `/adornment-library` to adminPages |
| Plugin | `src/admin.tsx` | Export `AdornmentLibrary` page |
| Plugin | `src/components/AdornmentLibrary.tsx` | NEW — library CRUD page |
| Plugin | `src/components/AdornmentPickerModal.tsx` | NEW — visual grid picker modal |
| Plugin | `src/components/blocks/MediaBlock.tsx` | Replace adornment repeater with picker |
| Plugin | `src/astro/Media.astro` | Resolve `_adornmentName` refs, backward-compat inline |
| Site | `src/types/emdash.ts` | Add `AdornmentRef`, `AdornmentValue`, `isAdornmentRef` |
| Site | `src/lib/fetch-emdash.ts` | Add `fetchAdornmentLibrary()` |
| Site | `src/components/BlockRenderer.astro` | Pass adornment library map to PortableText |
| Migration | `scripts/migrate-from-strapi.ts` | Add `--reset` flag, `seedAdornmentLibrary()`, update `getAdornmentsForMedia()` |

## Plugin: AdornmentLibrary page

**Route:** `/_emdash/admin/plugins/content-blocks/adornment-library`

### List view
A responsive grid of adornment cards. Each card:
- Image thumbnail at natural CSS size (so tape appears small, as it would look on a photo)
- Name below
- Edit (pencil) and Delete (×) buttons

"New Adornment" button above the grid opens the inline form.

### Create/Edit inline form
Slides in below the grid (not a modal). Fields:
- Name (text input, required)
- `ImagePicker` for the file
- Layout fields in `LayoutInput` 2-col grid: Width, Height, Padding, Margin, Top, Right, Bottom, Left
- Single-col: Rotation (number), Border, Filter
- "Save" button — calls `createContent` or `updateContent` + `publishContent`
- "Cancel" button

### Delete
Inline confirmation text ("Remove X? Pages using it will show nothing.") with confirm/cancel buttons. Calls `deleteContent` or equivalent via API.

### Data flow
- Load: `fetchContentList("adornments", { limit: 100 })` on mount
- Create: `createContent("adornments", { slug: slugify(name), data: {...}, status: "published" })`
- Update: `updateContent("adornments", id, { data: {...} })` + `publishContent`
- Delete: `DELETE /_emdash/api/content/adornments/:id`

## Plugin: AdornmentPickerModal

```typescript
interface AdornmentPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string) => void;
}
```

On open, fetches `fetchContentList("adornments", { limit: 100 })`.

Renders a 3-column grid of cards inside a modal. Each card:
- Image rendered with the adornment's CSS (height, rotation, filter etc.) so it looks as it would on a page
- Name below
- Click → calls `onSelect(adornment.name)` and closes

## Plugin: MediaBlock changes

The "Adornments" section inside "Advanced layout ▾" changes from a `Repeater<AdornmentBlock>` with 13 CSS fields to:

```tsx
{/* Current adornments as name chips */}
{block.adornments?.map((a, i) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border border-border text-sm">
    <span>{(a as AdornmentRef)._adornmentName ?? "(custom)"}</span>
    <button onClick={() => removeAdornment(i)}>×</button>
  </div>
))}

{/* Picker button */}
<button onClick={() => setPickerOpen(true)}>+ Add adornment</button>

<AdornmentPickerModal
  open={pickerOpen}
  onOpenChange={setPickerOpen}
  onSelect={(name) => addAdornment({ _adornmentName: name })}
/>
```

`block.adornments` type becomes `Array<AdornmentRef | AdornmentBlock>` — both shapes are valid, backward compatible.

## Site: Type changes (`src/types/emdash.ts`)

```typescript
// Reference to a named adornment in the library
export interface AdornmentRef {
  _adornmentName: string;
}

// Union: either a library reference or a legacy inline value
export type AdornmentValue = AdornmentBlock | AdornmentRef;

// Type guard
export function isAdornmentRef(a: AdornmentValue): a is AdornmentRef {
  return "_adornmentName" in a;
}
```

`MediaBlock.adornments` type changes from `AdornmentBlock[]` to `AdornmentValue[]`.

## Site: `fetchAdornmentLibrary()` (`src/lib/fetch-emdash.ts`)

```typescript
export function fetchAdornmentLibrary(): Map<string, AdornmentBlock> {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    type Row = {
      name: string; file: string;
      width: string | null; height: string | null;
      padding: string | null; margin: string | null;
      top: string | null; right: string | null;
      bottom: string | null; left: string | null;
      rotation: number | null; border: string | null; filter: string | null;
    };
    // EmDash stores each field as a real column on ec_adornments (not JSON blobs)
    const rows = db.prepare<[], Row>(`
      SELECT name, file, width, height, padding, margin,
             top, "right", bottom, "left", rotation, border, filter
      FROM ec_adornments
      WHERE status = 'published' AND deleted_at IS NULL
    `).all();
    db.close();
    const map = new Map<string, AdornmentBlock>();
    for (const row of rows) {
      const file = row.file ? JSON.parse(row.file) : { url: "", alt: null };
      map.set(row.name, {
        file,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        padding: row.padding ?? undefined,
        margin: row.margin ?? undefined,
        top: row.top ?? undefined,
        right: row.right ?? undefined,
        bottom: row.bottom ?? undefined,
        left: row.left ?? undefined,
        rotation: row.rotation ?? undefined,
        border: row.border ?? undefined,
        filter: row.filter ?? undefined,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}
```

## Site: BlockRenderer and Media.astro

`BlockRenderer.astro` calls `fetchAdornmentLibrary()` and passes the map through to `PortableText` via a custom component prop.

`Media.astro` receives the map and resolves each adornment:

```typescript
function resolveAdornment(a: AdornmentValue, library: Map<string, AdornmentBlock>): AdornmentBlock | null {
  if (isAdornmentRef(a)) {
    return library.get(a._adornmentName) ?? null;
  }
  return a; // legacy inline
}
```

Adornments that resolve to `null` (reference to a deleted library entry) are silently skipped.

## Migration script changes

### `--reset` flag

```bash
npm run migrate -- --reset
```

When passed, before seeding:
1. Fetches all items in each collection
2. Deletes each item via `DELETE /_emdash/api/content/:collection/:id`
3. Order: homepage → pages → sidebar → adornments → site

### `seedAdornmentLibrary()` (new, runs after `seedSite`, before `seedPages`)

```typescript
async function seedAdornmentLibrary(urlMap: Map<string, string>, cookie: string): Promise<void>
```

Reads from Strapi backup:
```sql
SELECT a.id, a.name,
       csm.width, csm.height, csm.rotation, csm.top, csm.left,
       csm.right, csm.bottom, csm.border, csm.filter, csm.padding, csm.margin,
       f.url as file_url, f.alternative_text
FROM adornments a
JOIN adornments_cmps ac ON ac.entity_id = a.id AND ac.component_type = 'shared.media'
JOIN components_shared_media csm ON csm.id = ac.cmp_id
JOIN files_related_mph frm ON frm.related_id = csm.id AND frm.related_type = 'shared.media'
JOIN files f ON f.id = frm.file_id
WHERE a.published_at IS NOT NULL
```

Creates each adornment in EmDash with `slug = slugify(name)` and data containing file + CSS fields.

### `getAdornmentsForMedia()` change

Instead of returning inline CSS, returns references:
```typescript
// Lookup the adornment name from the link table
const adornmentName = db.prepare<[number], { name: string }>(
  "SELECT a.name FROM adornments a WHERE a.id = ?"
).get(adornment_id)?.name;

if (!adornmentName) return [];
return [{ _adornmentName: adornmentName }];
```

### Updated seeding order
1. Site
2. **Adornment library** ← new
3. Pages
4. Sidebar
5. Homepage

## Backward compatibility

`Media.astro` handles both shapes — if `_adornmentName` exists, resolve from library; otherwise treat as legacy inline `AdornmentBlock`. This means the current migrated content (which uses inline CSS) still renders correctly even before re-migration.

## Out of scope
- Drag-to-reorder adornments on an image (↑/↓ buttons sufficient)
- Preview of adornment on top of the actual image in the picker (thumbnails only)
- Adornment categories/groups
- Custom one-off adornments (use library only)
