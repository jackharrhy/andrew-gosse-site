# Adornment Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw CSS adornment editing experience with a named adornment library — editors pick tape/decoration presets by name from a visual grid, blocks store lightweight references, and the renderer resolves them at render time.

**Architecture:** New `adornments` EmDash collection (created via admin UI). Plugin gains `AdornmentLibrary` admin page and `AdornmentPickerModal`. `Media.astro` calls `fetchAdornmentLibrary()` directly (synchronous SQLite) to resolve `{ _adornmentName }` references — no prop threading needed since `PortableText` doesn't support extra component props. Migration script gets `--reset` flag and `seedAdornmentLibrary()`.

**Tech Stack:** React 19, `@emdash-cms/admin`, `better-sqlite3`, Astro, TypeScript.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `src/types/emdash.ts` | Add `AdornmentRef`, `AdornmentValue`, `isAdornmentRef`; update `MediaBlock.adornments` type |
| Modify | `src/lib/fetch-emdash.ts` | Add `fetchAdornmentLibrary()` |
| Modify | `src/components/BlockRenderer.astro` | No change needed — Media.astro fetches library itself |
| Modify | `plugins/content-blocks/src/astro/Media.astro` | Resolve `_adornmentName` refs via `fetchAdornmentLibrary()` |
| Modify | `plugins/content-blocks/src/index.ts` | Add `/adornment-library` to adminPages |
| Modify | `plugins/content-blocks/src/admin.tsx` | Export `AdornmentLibrary` page |
| Create | `plugins/content-blocks/src/components/AdornmentLibrary.tsx` | CRUD page for adornment library |
| Create | `plugins/content-blocks/src/components/AdornmentPickerModal.tsx` | Visual grid picker modal |
| Modify | `plugins/content-blocks/src/components/blocks/MediaBlock.tsx` | Replace repeater with picker chips + modal |
| Modify | `scripts/migrate-from-strapi.ts` | Add `--reset`, `seedAdornmentLibrary()`, update `getAdornmentsForMedia()` |

---

## Task 1: Create the `adornments` collection in EmDash admin

**This is a manual step in the EmDash admin UI.**

The dev server must be running (`npm run dev` from the project root).

- [ ] **Step 1: Open the admin and navigate to Content Types**

```
http://localhost:4321/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin/content-types
```

- [ ] **Step 2: Create the `adornments` collection**

Click "New Collection". Set:
- Name: `adornment`
- Slug: `adornments`
- Kind: Collection

Add these fields:
| Field slug | Type | Notes |
|---|---|---|
| `name` | String | required |
| `file` | JSON | stores `{ url, alt }` |
| `width` | String | |
| `height` | String | |
| `padding` | String | |
| `margin` | String | |
| `top` | String | |
| `right` | String | |
| `bottom` | String | |
| `left` | String | |
| `rotation` | Number | degrees |
| `border` | String | |
| `filter` | String | CSS filter |

Save the schema.

- [ ] **Step 3: Verify the collection exists**

```bash
curl -sc /tmp/emc.cookie "http://localhost:4321/_emdash/api/auth/dev-bypass" -o /dev/null && \
curl -sb /tmp/emc.cookie "http://localhost:4321/_emdash/api/content/adornments?limit=1" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('ok:', 'items' in d.get('data', {}))"
```

Expected: `ok: True`

- [ ] **Step 4: Commit (empty — schema lives in DB)**

```bash
git -C /Users/jack/repos/personal/andrew-gosse-site commit --allow-empty -m "chore: create adornments collection in EmDash schema"
```

---

## Task 2: Update types and `fetchAdornmentLibrary`

**Files:**
- Modify: `src/types/emdash.ts`
- Modify: `src/lib/fetch-emdash.ts`

- [ ] **Step 1: Update `src/types/emdash.ts`**

Replace the entire file:

```typescript
export interface MediaFile {
  url: string;
  alt: string | null;
}

export interface AdornmentBlock {
  file: MediaFile;
  width?: string;
  height?: string;
  padding?: string;
  margin?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  rotation?: number;
  border?: string;
  filter?: string;
}

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

export interface MediaBlock {
  _type: "media";
  file: MediaFile;
  width?: string;
  height?: string;
  padding?: string;
  margin?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  rotation?: number;
  border?: string;
  filter?: string;
  adornments?: AdornmentValue[];  // changed from AdornmentBlock[]
}

export interface RichTextBlock {
  _type: "richText";
  body: string;
}

export interface SpecialComponentBlock {
  _type: "specialComponent";
  type: "riso_colors";
}

export type Block = MediaBlock | RichTextBlock | SpecialComponentBlock;

export interface SidebarItem {
  text: string;
  page: { slug: string };
}

export interface SidebarCategory {
  categoryTitle: string;
  backgroundImage?: MediaFile | null;
  items: SidebarItem[];
}

export interface SidebarLink {
  service: string;
  url: string;
}
```

- [ ] **Step 2: Add `fetchAdornmentLibrary` to `src/lib/fetch-emdash.ts`**

Add after the `fetchSite` function:

```typescript
/**
 * Load all published adornments from ec_adornments as a name→AdornmentBlock map.
 * Used by Media.astro to resolve _adornmentName references at render time.
 * Synchronous SQLite read — fast (~1ms for small library).
 */
export function fetchAdornmentLibrary(): Map<string, AdornmentBlock> {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    type Row = {
      name: string;
      file: string | null;
      width: string | null;
      height: string | null;
      padding: string | null;
      margin: string | null;
      top: string | null;
      right: string | null;
      bottom: string | null;
      left: string | null;
      rotation: number | null;
      border: string | null;
      filter: string | null;
    };
    const rows = db
      .prepare<[], Row>(
        `SELECT name, file, width, height, padding, margin,
                top, "right", bottom, "left", rotation, border, filter
         FROM ec_adornments
         WHERE status = 'published' AND deleted_at IS NULL`
      )
      .all();
    db.close();
    const map = new Map<string, AdornmentBlock>();
    for (const row of rows) {
      const file: MediaFile = row.file
        ? (JSON.parse(row.file) as MediaFile)
        : { url: "", alt: null };
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

Also add `AdornmentBlock` to the import line at the top of `fetch-emdash.ts`:

```typescript
import type { Block, AdornmentBlock, MediaFile, SidebarCategory, SidebarLink } from "../types/emdash";
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site && npm run build 2>&1 | grep -E "^.*error" | grep -v "npm\|audit\|peer\|deprecat" | head -10
```

Expected: no TypeScript errors. (Build may fail on other things but TS errors in src/ should be zero.)

- [ ] **Step 4: Commit**

```bash
git add src/types/emdash.ts src/lib/fetch-emdash.ts && git commit -m "feat: add AdornmentRef type and fetchAdornmentLibrary() for named adornment resolution"
```

---

## Task 3: Update `Media.astro` to resolve references

**Files:**
- Modify: `plugins/content-blocks/src/astro/Media.astro`

- [ ] **Step 1: Replace the entire file**

```astro
---
// Renders a media block. Handles three adornment shapes:
// 1. Library reference: { _adornmentName: "top left blue tape" } — resolved via fetchAdornmentLibrary()
// 2. Legacy inline: { file: {...}, height: "2rem", ... } — used as-is (backward compat)
// 3. Legacy JSON string (from old Block Kit editor) — parsed then treated as inline
import type { MediaBlock, AdornmentBlock, AdornmentValue } from "@site/types/emdash";
import { fetchAdornmentLibrary, isAdornmentRef } from "@site/lib/fetch-emdash";

type FlatMediaNode = {
  file_url?: string;
  file_alt?: string;
  adornments?: string | AdornmentValue[];
  width?: string;
  height?: string;
  padding?: string;
  margin?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  rotation?: number;
  border?: string;
  filter?: string;
};

type Node = MediaBlock | FlatMediaNode;

const node = Astro.props.node as Node;

// Load adornment library for reference resolution (fast synchronous SQLite read)
const adornmentLibrary = fetchAdornmentLibrary();

// Normalise file regardless of shape
const fileUrl =
  "file" in node && node.file?.url
    ? node.file.url
    : "file_url" in node
    ? (node as FlatMediaNode).file_url ?? ""
    : "";

const fileAlt =
  "file" in node && node.file
    ? (node.file.alt ?? "")
    : "file_alt" in node
    ? ((node as FlatMediaNode).file_alt ?? "")
    : "";

// Normalise raw adornments array (handles JSON string from legacy Block Kit editor)
let rawAdornments: AdornmentValue[] = [];
const rawAdornmentsField =
  "adornments" in node ? (node as MediaBlock | FlatMediaNode).adornments : undefined;

if (Array.isArray(rawAdornmentsField)) {
  rawAdornments = rawAdornmentsField as AdornmentValue[];
} else if (typeof rawAdornmentsField === "string" && rawAdornmentsField.trim()) {
  try {
    rawAdornments = JSON.parse(rawAdornmentsField) as AdornmentValue[];
  } catch {
    // invalid JSON — ignore
  }
}

// Resolve all adornments: references → library lookups, inline → pass through
const adornments: AdornmentBlock[] = rawAdornments.flatMap((a) => {
  if (isAdornmentRef(a)) {
    const resolved = adornmentLibrary.get(a._adornmentName);
    return resolved ? [resolved] : []; // silently skip unknown refs
  }
  return [a as AdornmentBlock]; // legacy inline
});

const rotation = typeof node.rotation === "number" ? node.rotation : 0;
const border = typeof node.border === "string" ? node.border : undefined;
const margin = typeof node.margin === "string" ? node.margin : "0 auto";

const containerStyle = {
  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
  width: node.width,
  maxWidth: "100%",
  padding: node.padding,
  margin,
};

const imgStyle = {
  left: node.left,
  top: node.top,
  bottom: node.bottom,
  right: node.right,
  filter: node.filter,
  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
  border,
  width: node.width,
  height: "auto",
  maxHeight: node.height,
  padding: node.padding,
  margin,
};

function adornmentStyle(a: AdornmentBlock) {
  const aRot = typeof a.rotation === "number" ? a.rotation : 0;
  return {
    position: "absolute",
    left: a.left,
    top: a.top,
    bottom: a.bottom,
    right: a.right,
    filter: a.filter,
    transform: aRot !== 0 ? `rotate(${aRot}deg)` : undefined,
    border: a.border,
    width: a.width,
    maxHeight: a.height,
    padding: a.padding,
    margin: a.margin,
  };
}
---

{adornments.length > 0 ? (
  <div style={containerStyle} class="image-with-adornments relative not-prose">
    <img src={fileUrl} alt={fileAlt} style={{ filter: node.filter, maxHeight: node.height, border }} />
    {adornments.map((adornment) => (
      <img
        src={adornment.file?.url ?? ""}
        alt={adornment.file?.alt ?? ""}
        style={adornmentStyle(adornment)}
      />
    ))}
  </div>
) : (
  <img src={fileUrl} alt={fileAlt} style={imgStyle} />
)}

<style>
  img {
    max-width: 100%;
    height: auto;
  }

  .image-with-adornments {
    display: block;
    max-width: 100%;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .image-with-adornments > img:first-child {
    display: block;
    max-width: 100%;
    height: auto;
    object-fit: contain;
  }

  .image-with-adornments > img:not(:first-child) {
    pointer-events: none;
    max-width: none;
  }
</style>
```

- [ ] **Step 2: Verify the about page still renders with adornments**

```bash
curl -s http://localhost:4321/about | grep -c "image-with-adornments"
```

Expected: `1` or more (the about page has a photo with tape adornments).

- [ ] **Step 3: Commit**

```bash
git add plugins/content-blocks/src/astro/Media.astro && git commit -m "feat: Media.astro resolves _adornmentName references via fetchAdornmentLibrary()"
```

---

## Task 4: `AdornmentPickerModal.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/AdornmentPickerModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/AdornmentPickerModal.tsx
import * as React from "react";
import { fetchContentList } from "@emdash-cms/admin";

interface AdornmentItem {
  id: string;
  slug: string | null;
  data: {
    name: string;
    file?: { url: string; alt: string } | null;
    height?: string | null;
    width?: string | null;
    rotation?: number | null;
    filter?: string | null;
    top?: string | null;
    right?: string | null;
    bottom?: string | null;
    left?: string | null;
    padding?: string | null;
    margin?: string | null;
  };
}

interface AdornmentPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string) => void;
}

export function AdornmentPickerModal({ open, onOpenChange, onSelect }: AdornmentPickerModalProps) {
  const [adornments, setAdornments] = React.useState<AdornmentItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchContentList("adornments", { limit: 100 })
      .then((result) => setAdornments(result.items as AdornmentItem[]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-card rounded-lg border border-border shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Pick an adornment</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading && (
            <div className="text-muted-foreground text-sm">Loading adornments…</div>
          )}
          {!loading && adornments.length === 0 && (
            <div className="text-muted-foreground text-sm">
              No adornments in the library yet.{" "}
              <a
                href="/_emdash/admin/plugins/content-blocks/adornment-library"
                className="underline hover:text-foreground"
              >
                Add some first.
              </a>
            </div>
          )}
          {!loading && adornments.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {adornments.map((a) => {
                const d = a.data;
                const rot = typeof d.rotation === "number" ? d.rotation : 0;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { onSelect(d.name); onOpenChange(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-md border border-border hover:border-ring hover:bg-accent/50 transition-colors text-left"
                  >
                    {/* Thumbnail — render at natural adornment CSS size */}
                    <div className="h-16 flex items-center justify-center overflow-hidden">
                      {d.file?.url ? (
                        <img
                          src={d.file.url}
                          alt={d.file.alt ?? d.name}
                          style={{
                            height: d.height ?? "auto",
                            width: d.width ?? "auto",
                            maxHeight: "4rem",
                            maxWidth: "100%",
                            transform: rot !== 0 ? `rotate(${rot}deg)` : undefined,
                            filter: d.filter ?? undefined,
                          }}
                        />
                      ) : (
                        <div className="w-12 h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-center text-muted-foreground leading-tight">
                      {d.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site && git add plugins/content-blocks/src/components/AdornmentPickerModal.tsx && git commit -m "feat: add AdornmentPickerModal component"
```

---

## Task 5: Update `MediaBlock.tsx` — replace repeater with picker chips

**Files:**
- Modify: `plugins/content-blocks/src/components/blocks/MediaBlock.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
// plugins/content-blocks/src/components/blocks/MediaBlock.tsx
import * as React from "react";
import { ImagePicker } from "../ImagePicker";
import { AdornmentPickerModal } from "../AdornmentPickerModal";
import type { MediaBlock as MediaBlockType, AdornmentValue, AdornmentRef } from "@site/types/emdash";

interface Props {
  block: MediaBlockType;
  onChange: (block: MediaBlockType) => void;
}

interface LayoutInputProps {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
}

function LayoutInput({ label, value, onChange, type = "text", placeholder }: LayoutInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</p>
  );
}

export function MediaBlock({ block, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const update = (patch: Partial<MediaBlockType>) =>
    onChange({ ...block, ...patch });

  const adornments: AdornmentValue[] = block.adornments ?? [];

  const addAdornment = (name: string) => {
    const ref: AdornmentRef = { _adornmentName: name };
    update({ adornments: [...adornments, ref] });
  };

  const removeAdornment = (index: number) => {
    update({ adornments: adornments.filter((_, i) => i !== index) });
  };

  const getAdornmentLabel = (a: AdornmentValue): string => {
    if ("_adornmentName" in a) return a._adornmentName;
    return "(legacy inline)";
  };

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media</span>
      </div>
      <div className="p-4 flex flex-col gap-5">
        {/* Always visible: image picker */}
        <ImagePicker
          label="Image"
          value={block.file?.url ? { url: block.file.url, alt: block.file.alt ?? "" } : null}
          onChange={(val) =>
            update({ file: val ? { url: val.url, alt: val.alt } : { url: "", alt: null } })
          }
        />

        {/* Advanced layout toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="self-start text-sm px-4 py-1.5 rounded-md border border-input hover:bg-accent font-medium flex items-center gap-2 transition-colors"
        >
          <span>Layout &amp; positioning</span>
          <span className="text-muted-foreground">{showAdvanced ? "▴" : "▾"}</span>
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-6 pl-4 border-l-2 border-border">
            {/* Dimensions & spacing */}
            <div>
              <SectionLabel>Dimensions &amp; spacing</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <LayoutInput label="Width" value={block.width} placeholder="e.g. 400px or 80%" onChange={(v) => update({ width: v || undefined })} />
                <LayoutInput label="Max height" value={block.height} placeholder="e.g. 30rem" onChange={(v) => update({ height: v || undefined })} />
                <LayoutInput label="Padding" value={block.padding} placeholder="e.g. 1rem" onChange={(v) => update({ padding: v || undefined })} />
                <LayoutInput label="Margin" value={block.margin} placeholder="e.g. 0 auto" onChange={(v) => update({ margin: v || undefined })} />
              </div>
            </div>

            {/* Position */}
            <div>
              <SectionLabel>Position offset</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <LayoutInput label="Top" value={block.top} placeholder="e.g. 10px" onChange={(v) => update({ top: v || undefined })} />
                <LayoutInput label="Right" value={block.right} placeholder="e.g. 10px" onChange={(v) => update({ right: v || undefined })} />
                <LayoutInput label="Bottom" value={block.bottom} placeholder="e.g. 10px" onChange={(v) => update({ bottom: v || undefined })} />
                <LayoutInput label="Left" value={block.left} placeholder="e.g. 10px" onChange={(v) => update({ left: v || undefined })} />
              </div>
            </div>

            {/* Style */}
            <div>
              <SectionLabel>Style</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <LayoutInput
                  label="Rotation (degrees)"
                  value={block.rotation}
                  type="number"
                  placeholder="e.g. -2"
                  onChange={(v) => update({ rotation: v ? Number(v) : undefined })}
                />
                <LayoutInput label="Border" value={block.border} placeholder="e.g. 2px solid black" onChange={(v) => update({ border: v || undefined })} />
                <div className="col-span-2">
                  <LayoutInput label="CSS Filter" value={block.filter} placeholder="e.g. grayscale(100%)" onChange={(v) => update({ filter: v || undefined })} />
                </div>
              </div>
            </div>

            {/* Adornments — named library references */}
            <div>
              <SectionLabel>Adornments</SectionLabel>
              <p className="text-xs text-muted-foreground mb-3">
                Decorative images layered on top (tape, lines, etc.). Pick from the{" "}
                <a
                  href="/_emdash/admin/plugins/content-blocks/adornment-library"
                  className="underline hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Adornment Library
                </a>.
              </p>

              {/* Current adornments as chips */}
              {adornments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {adornments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-sm"
                    >
                      <span className="text-foreground">{getAdornmentLabel(a)}</span>
                      <button
                        type="button"
                        onClick={() => removeAdornment(i)}
                        className="text-muted-foreground hover:text-destructive leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-accent transition-colors"
              >
                + Add adornment
              </button>

              <AdornmentPickerModal
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={addAdornment}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site && npm run dev > /tmp/astro-dev-adorn.log 2>&1 &
sleep 10 && curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/ && echo ""
cat /tmp/astro-dev-adorn.log | grep -iE "TypeError|Error" | grep -v "Experimental\|WARN\|deprecat" | head -5
```

Expected: 200, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add plugins/content-blocks/src/components/blocks/MediaBlock.tsx && git commit -m "feat: replace adornment repeater in MediaBlock with named library picker"
```

---

## Task 6: `AdornmentLibrary.tsx` admin page

**Files:**
- Create: `plugins/content-blocks/src/components/AdornmentLibrary.tsx`
- Modify: `plugins/content-blocks/src/index.ts`
- Modify: `plugins/content-blocks/src/admin.tsx`

- [ ] **Step 1: Create `AdornmentLibrary.tsx`**

```typescript
// plugins/content-blocks/src/components/AdornmentLibrary.tsx
import * as React from "react";
import {
  fetchContentList,
  createContent,
  updateContent,
  publishContent,
  deleteContent,
} from "@emdash-cms/admin";
import { ImagePicker } from "./ImagePicker";

interface AdornmentData {
  name: string;
  file?: { url: string; alt: string } | null;
  width?: string | null;
  height?: string | null;
  padding?: string | null;
  margin?: string | null;
  top?: string | null;
  right?: string | null;
  bottom?: string | null;
  left?: string | null;
  rotation?: number | null;
  border?: string | null;
  filter?: string | null;
}

interface AdornmentItem {
  id: string;
  slug: string | null;
  data: AdornmentData;
}

interface FormState {
  name: string;
  file: { url: string; alt: string } | null;
  width: string;
  height: string;
  padding: string;
  margin: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  rotation: string;
  border: string;
  filter: string;
}

function emptyForm(): FormState {
  return {
    name: "", file: null,
    width: "", height: "", padding: "", margin: "",
    top: "", right: "", bottom: "", left: "",
    rotation: "", border: "", filter: "",
  };
}

function dataFromForm(f: FormState): AdornmentData {
  return {
    name: f.name,
    file: f.file,
    width: f.width || null,
    height: f.height || null,
    padding: f.padding || null,
    margin: f.margin || null,
    top: f.top || null,
    right: f.right || null,
    bottom: f.bottom || null,
    left: f.left || null,
    rotation: f.rotation ? Number(f.rotation) : null,
    border: f.border || null,
    filter: f.filter || null,
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function LayoutInput({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: "text" | "number"; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function AdornmentLibrary() {
  const [adornments, setAdornments] = React.useState<AdornmentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchContentList("adornments", { limit: 100 })
      .then((r) => setAdornments(r.items as AdornmentItem[]))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  };

  const openEdit = (item: AdornmentItem) => {
    setEditingId(item.id);
    const d = item.data;
    setForm({
      name: d.name,
      file: d.file ?? null,
      width: d.width ?? "",
      height: d.height ?? "",
      padding: d.padding ?? "",
      margin: d.margin ?? "",
      top: d.top ?? "",
      right: d.right ?? "",
      bottom: d.bottom ?? "",
      left: d.left ?? "",
      rotation: d.rotation != null ? String(d.rotation) : "",
      border: d.border ?? "",
      filter: d.filter ?? "",
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const data = dataFromForm(form);
      if (editingId) {
        await updateContent("adornments", editingId, { data });
        await publishContent("adornments", editingId);
      } else {
        // createContent returns the new ContentItem with its id
        const created = await createContent("adornments", {
          slug: slugify(form.name),
          data,
          status: "published",
        });
        await publishContent("adornments", created.id);
      }
      setForm(null);
      setEditingId(null);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContent("adornments", id);
      setDeleteConfirm(null);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const updateForm = (patch: Partial<FormState>) =>
    setForm((prev) => prev ? { ...prev, ...patch } : prev);

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Adornment Library</h1>
          <p className="text-sm text-muted-foreground">
            Named decorative presets (tape, lines) that can be placed on images.
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            + New adornment
          </button>
        )}
      </div>

      {/* Inline create/edit form */}
      {form && (
        <div className="rounded-md border border-border bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold">{editingId ? "Edit adornment" : "New adornment"}</h2>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Name <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="e.g. top left blue tape"
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Image */}
          <ImagePicker
            label="Image"
            value={form.file}
            onChange={(v) => updateForm({ file: v })}
          />

          {/* Layout fields */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Layout</p>
            <div className="grid grid-cols-2 gap-3">
              <LayoutInput label="Width" value={form.width} placeholder="e.g. auto" onChange={(v) => updateForm({ width: v })} />
              <LayoutInput label="Height" value={form.height} placeholder="e.g. 2rem" onChange={(v) => updateForm({ height: v })} />
              <LayoutInput label="Padding" value={form.padding} placeholder="e.g. 0" onChange={(v) => updateForm({ padding: v })} />
              <LayoutInput label="Margin" value={form.margin} placeholder="e.g. 0" onChange={(v) => updateForm({ margin: v })} />
              <LayoutInput label="Top" value={form.top} placeholder="e.g. -0.5rem" onChange={(v) => updateForm({ top: v })} />
              <LayoutInput label="Right" value={form.right} placeholder="e.g. -1.5rem" onChange={(v) => updateForm({ right: v })} />
              <LayoutInput label="Bottom" value={form.bottom} placeholder="e.g. -0.5rem" onChange={(v) => updateForm({ bottom: v })} />
              <LayoutInput label="Left" value={form.left} placeholder="e.g. -1.5rem" onChange={(v) => updateForm({ left: v })} />
              <LayoutInput label="Rotation (°)" value={form.rotation} type="number" placeholder="e.g. -25" onChange={(v) => updateForm({ rotation: v })} />
              <LayoutInput label="Border" value={form.border} placeholder="e.g. none" onChange={(v) => updateForm({ border: v })} />
              <div className="col-span-2">
                <LayoutInput label="CSS Filter" value={form.filter} placeholder="e.g. hue-rotate(45deg)" onChange={(v) => updateForm({ filter: v })} />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive rounded-md border border-destructive bg-destructive/10 p-3">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setForm(null); setEditingId(null); setError(null); }}
              className="px-4 py-2 rounded-md border border-input text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Library grid */}
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : adornments.length === 0 ? (
        <div className="text-muted-foreground text-sm py-8 text-center border border-dashed border-border rounded-md">
          No adornments yet. Click "+ New adornment" to add one.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {adornments.map((item) => {
            const d = item.data;
            const rot = typeof d.rotation === "number" ? d.rotation : 0;
            const isDeleting = deleteConfirm === item.id;
            return (
              <div
                key={item.id}
                className="rounded-md border border-border bg-card p-3 flex flex-col gap-2"
              >
                {/* Thumbnail */}
                <div className="h-16 flex items-center justify-center bg-muted/30 rounded overflow-hidden">
                  {d.file?.url ? (
                    <img
                      src={d.file.url}
                      alt={d.file.alt ?? d.name}
                      style={{
                        height: d.height ?? "auto",
                        width: d.width ?? "auto",
                        maxHeight: "4rem",
                        maxWidth: "100%",
                        transform: rot !== 0 ? `rotate(${rot}deg)` : undefined,
                        filter: d.filter ?? undefined,
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>

                <span className="text-xs font-medium text-center truncate">{d.name}</span>

                {isDeleting ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-muted-foreground text-center">Remove? Pages using it will show nothing.</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="flex-1 text-xs px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 text-xs px-2 py-1 rounded border border-input hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="flex-1 text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(item.id)}
                      className="flex-1 text-xs px-2 py-1 rounded border border-input text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `/adornment-library` to `plugins/content-blocks/src/index.ts`**

In both the `contentBlocksPlugin()` descriptor and `createPlugin()` admin block, add the new page to the `adminPages`/`pages` arrays:

```typescript
{ path: "/adornment-library", label: "Adornment Library", icon: "link" },
```

The full updated arrays become:
```typescript
adminPages: [
  { path: "/sidebar", label: "Sidebar", icon: "link" },
  { path: "/page-editor", label: "Page Editor", icon: "link" },
  { path: "/seo-audit", label: "SEO Audit", icon: "link" },
  { path: "/adornment-library", label: "Adornment Library", icon: "link" },
],
```

- [ ] **Step 3: Update `plugins/content-blocks/src/admin.tsx`**

```typescript
// plugins/content-blocks/src/admin.tsx
import { SidebarEditor } from "./components/SidebarEditor";
import { PageEditor } from "./components/PageEditor";
import { SeoAudit } from "./components/SeoAudit";
import { AdornmentLibrary } from "./components/AdornmentLibrary";
import { ColorPicker } from "./components/ColorPicker";
import { SidebarFieldRedirect } from "./components/SidebarFieldRedirect";
import { BlocksFieldRedirect } from "./components/BlocksFieldRedirect";

export const pages = {
  "/sidebar": SidebarEditor,
  "/page-editor": PageEditor,
  "/seo-audit": SeoAudit,
  "/adornment-library": AdornmentLibrary,
};

export const fields = {
  colorPicker: ColorPicker,
  sidebarField: SidebarFieldRedirect,
  blocksField: BlocksFieldRedirect,
};
```

- [ ] **Step 4: Verify the Adornment Library page loads**

Navigate to `http://localhost:4321/_emdash/admin/plugins/content-blocks/adornment-library` — should show the empty library grid with a "+ New adornment" button.

- [ ] **Step 5: Commit**

```bash
git add plugins/content-blocks/src/components/AdornmentLibrary.tsx plugins/content-blocks/src/index.ts plugins/content-blocks/src/admin.tsx && git commit -m "feat: add AdornmentLibrary admin page and register in plugin"
```

---

## Task 7: Update migration script

**Files:**
- Modify: `scripts/migrate-from-strapi.ts`

This task has three parts: `--reset` flag, `seedAdornmentLibrary()`, and update `getAdornmentsForMedia()`.

- [ ] **Step 1: Add `--reset` flag and `deleteAllContent()` helper**

After the `publishContent` function, add:

```typescript
// ─── Reset helpers ────────────────────────────────────────────────────────────

async function deleteAllContent(collection: string, cookie: string): Promise<void> {
  const res = await fetch(`${EMDASH_API}/content/${collection}?limit=250`, {
    headers: { Cookie: cookie, Origin: EMDASH_URL },
  });
  if (!res.ok) return;
  const json = (await res.json()) as { data?: { items?: Array<{ id: string }> } };
  const items = json.data?.items ?? [];
  for (const item of items) {
    await fetch(`${EMDASH_API}/content/${collection}/${item.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie, "X-EmDash-Request": "1", Origin: EMDASH_URL },
    });
  }
  console.log(`  ✓ Deleted ${items.length} items from ${collection}`);
}

async function resetAllContent(cookie: string): Promise<void> {
  console.log("\n--- Resetting all content ---");
  for (const collection of ["homepage", "pages", "sidebar", "adornments", "site"]) {
    await deleteAllContent(collection, cookie);
  }
}
```

- [ ] **Step 2: Add `seedAdornmentLibrary()` function**

Add after `seedSite`:

```typescript
async function seedAdornmentLibrary(urlMap: Map<string, string>, cookie: string): Promise<void> {
  console.log("\n--- Seeding adornment library ---");

  type AdornmentRow = {
    id: number;
    name: string;
    width: string | null;
    height: string | null;
    rotation: number | null;
    top: string | null;
    left: string | null;
    right: string | null;
    bottom: string | null;
    border: string | null;
    filter: string | null;
    padding: string | null;
    margin: string | null;
    file_url: string;
    alternative_text: string | null;
  };

  const adornments = db
    .prepare<[], AdornmentRow>(
      `SELECT a.id, a.name,
              csm.width, csm.height, csm.rotation, csm.top, csm.left,
              csm.right, csm.bottom, csm.border, csm.filter, csm.padding, csm.margin,
              f.url as file_url, f.alternative_text
       FROM adornments a
       JOIN adornments_cmps ac ON ac.entity_id = a.id AND ac.component_type = 'shared.media'
       JOIN components_shared_media csm ON csm.id = ac.cmp_id
       JOIN files_related_mph frm ON frm.related_id = csm.id AND frm.related_type = 'shared.media'
       JOIN files f ON f.id = frm.file_id
       WHERE a.published_at IS NOT NULL`
    )
    .all();

  console.log(`  Found ${adornments.length} adornments`);

  for (const a of adornments) {
    const exists = await contentExists("adornments", slugify(a.name), cookie);
    if (exists) {
      console.log(`  adornment/${a.name} already exists, skipping`);
      continue;
    }

    const emdashUrl = urlMap.get(a.file_url) ?? a.file_url;

    await createContent(
      "adornments",
      {
        slug: slugify(a.name),
        data: {
          name: a.name,
          file: { url: emdashUrl, alt: a.alternative_text ?? null },
          width: a.width ?? null,
          height: a.height ?? null,
          padding: a.padding ?? null,
          margin: a.margin ?? null,
          top: a.top ?? null,
          right: a.right ?? null,
          bottom: a.bottom ?? null,
          left: a.left ?? null,
          rotation: a.rotation ?? null,
          border: a.border ?? null,
          filter: a.filter ?? null,
        },
        status: "published",
      },
      cookie
    );
    await publishContent("adornments", slugify(a.name), cookie);
    console.log(`  ✓ adornment/${a.name}`);
  }
}
```

Also add the `slugify` helper near the top of the file (after the constants):

```typescript
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
```

- [ ] **Step 3: Update `getAdornmentsForMedia()` to return references**

Replace the existing `getAdornmentsForMedia` function:

```typescript
function getAdornmentsForMedia(mediaId: number, _urlMap: Map<string, string>): object[] {
  const links = db
    .prepare<[number], { adornment_id: number }>(
      `SELECT adornment_id FROM components_shared_media_adornments_lnk
       WHERE media_id = ? ORDER BY adornment_ord`
    )
    .all(mediaId);

  return links.flatMap(({ adornment_id }) => {
    const adornment = db
      .prepare<[number], { name: string }>(
        "SELECT name FROM adornments WHERE id = ? AND published_at IS NOT NULL LIMIT 1"
      )
      .get(adornment_id);

    if (!adornment) return [];
    return [{ _adornmentName: adornment.name }];
  });
}
```

- [ ] **Step 4: Update `main()` to handle `--reset` and new seeding order**

Replace the `main` function:

```typescript
async function main() {
  const args = process.argv.slice(2);
  const doReset = args.includes("--reset");

  console.log("Strapi → EmDash migration\n");
  console.log(`DB: ${DB_PATH}`);
  console.log(`Uploads: ${UPLOADS_PATH}`);
  console.log(`EmDash: ${EMDASH_URL}`);
  if (doReset) console.log("Mode: --reset (will wipe existing content)\n");
  else console.log("Mode: incremental (skips existing)\n");

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Strapi DB not found at ${DB_PATH}`);
  }
  if (!fs.existsSync(UPLOADS_PATH)) {
    throw new Error(`Uploads not found at ${UPLOADS_PATH}`);
  }

  const cookie = await getSessionCookie();
  console.log("✓ Authenticated with EmDash\n");

  if (doReset) {
    await resetAllContent(cookie);
  }

  const urlMap = await uploadAllMedia(cookie);
  console.log(`\n✓ Uploaded ${urlMap.size} media files`);

  await seedSite(urlMap, cookie);
  await seedAdornmentLibrary(urlMap, cookie);
  await seedPages(urlMap, cookie);
  await seedSidebar(urlMap, cookie);
  await seedHomepage(urlMap, cookie);

  console.log("\n✓ Migration complete!");
  db.close();
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-from-strapi.ts && git commit -m "feat: migration script — add --reset flag, seedAdornmentLibrary(), adornments stored as name references"
```

---

## Task 8: Run the migration and verify end-to-end

The dev server must be running and the `adornments` collection must exist (Task 1).

- [ ] **Step 1: Run migration with --reset to get a clean slate**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site/scripts && npm run migrate -- --reset
```

Expected output includes:
```
--- Resetting all content ---
  ✓ Deleted N items from homepage
  ✓ Deleted N items from pages
  ...
--- Seeding adornment library ---
  Found 13 adornments
  ✓ adornment/list style 1
  ✓ adornment/tape top left 1
  ...
--- Seeding pages ---
  Found 21 published pages
  ✓ page/about
  ...
✓ Migration complete!
```

- [ ] **Step 2: Verify adornment library in admin**

```
http://localhost:4321/_emdash/admin/plugins/content-blocks/adornment-library
```

Should show 13 adornment cards with thumbnails. All tape variants should show coloured tape images.

- [ ] **Step 3: Verify site renders adornments correctly**

```bash
curl -s http://localhost:4321/about | grep -c "image-with-adornments"
curl -s http://localhost:4321/letters-from-toronto | grep -c "image-with-adornments"
```

Expected: 1 and 3 (or more) respectively.

- [ ] **Step 4: Verify adornments are stored as references in the DB**

```bash
sqlite3 /Users/jack/repos/personal/andrew-gosse-site/data/emdash.db "
SELECT substr(r.data, instr(r.data, '\"adornments\"'), 120)
FROM ec_pages p
JOIN revisions r ON r.id = p.live_revision_id
WHERE p.slug = 'about';" | python3 -c "import sys; print(sys.stdin.read())"
```

Expected output includes `"_adornmentName":"top left blue tape"` (not inline CSS).

- [ ] **Step 5: Test the adornment picker in the Page Editor**

Navigate to:
```
http://localhost:4321/_emdash/admin/plugins/content-blocks/page-editor?id=<about-page-id>&collection=pages
```

Open a media block's "Layout & positioning" → "Adornments" section. Should show:
- Current adornments as chips with names ("top left blue tape", "bottom right purple tape")
- "+ Add adornment" button that opens the visual grid picker

- [ ] **Step 6: Commit final state**

```bash
git -C /Users/jack/repos/personal/andrew-gosse-site add -A && git commit -m "chore: end-to-end verification of adornment library migration and admin UX"
```
