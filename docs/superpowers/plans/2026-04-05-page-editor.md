# Page Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bespoke inline page editor for the content-blocks plugin — no dialogs, WYSIWYG-ish rich text (markdown + live preview), media blocks with collapsed layout fields, and a redirect widget on the standard EmDash page/homepage editors.

**Architecture:** Seven new React components added to `plugins/content-blocks/src/components/`, one existing plugin descriptor update, one `admin.tsx` update, and one SQLite DB update to wire the redirect widget. The `PageEditor` page reads `?id=&collection=` from the URL, fetches via `fetchContent`, and saves via `updateContent` + `publishContent`. All block edits are inline with no modals.

**Tech Stack:** React 19, `@emdash-cms/admin` (fetchContent, fetchContentList, updateContent, publishContent), `marked` (markdown→HTML preview), TypeScript, Tailwind v4 design tokens.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `plugins/content-blocks/src/index.ts` | Add `/page-editor` to adminPages + `blocksField` to fieldWidgets |
| Modify | `plugins/content-blocks/src/admin.tsx` | Export `PageEditor` page + `BlocksFieldRedirect` field |
| Create | `plugins/content-blocks/src/components/BlocksFieldRedirect.tsx` | Redirect widget for blocks fields |
| Create | `plugins/content-blocks/src/components/blocks/SpecialComponentBlock.tsx` | Single select for specialComponent type |
| Create | `plugins/content-blocks/src/components/blocks/RichTextBlock.tsx` | Markdown textarea + live HTML preview |
| Create | `plugins/content-blocks/src/components/blocks/MediaBlock.tsx` | Image picker + collapsed layout fields + adornments |
| Create | `plugins/content-blocks/src/components/BlockList.tsx` | Ordered block list, add/remove/reorder, type dispatch |
| Create | `plugins/content-blocks/src/components/PageEditor.tsx` | Top-level page: load/save/state/fallback page list |

---

## Task 1: Update plugin descriptor and admin.tsx

**Files:**
- Modify: `plugins/content-blocks/src/index.ts`
- Modify: `plugins/content-blocks/src/admin.tsx`

- [ ] **Step 1: Update `index.ts` — add `/page-editor` adminPage and `blocksField` widget**

Replace the `contentBlocksPlugin()` function and the `admin` section of `createPlugin()`:

```typescript
// plugins/content-blocks/src/index.ts
import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

export function contentBlocksPlugin(): PluginDescriptor {
  return {
    id: "content-blocks",
    version: "0.1.0",
    entrypoint: "@andrew-gosse-site/plugin-content-blocks",
    componentsEntry: "@andrew-gosse-site/plugin-content-blocks/astro",
    adminEntry: "@andrew-gosse-site/plugin-content-blocks/admin",
    adminPages: [
      { path: "/sidebar", label: "Sidebar", icon: "link" },
      { path: "/page-editor", label: "Page Editor", icon: "link" },
    ],
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
      pages: [
        { path: "/sidebar", label: "Sidebar", icon: "link" },
        { path: "/page-editor", label: "Page Editor", icon: "link" },
      ],
      fieldWidgets: [
        { name: "colorPicker", label: "Color Picker", fieldTypes: ["string"] },
        { name: "sidebarField", label: "Sidebar Field", fieldTypes: ["json"] },
        { name: "blocksField", label: "Blocks Field", fieldTypes: ["portableText"] },
      ],
      portableTextBlocks: [
        {
          type: "richText",
          label: "Rich Text",
          icon: "code",
          description: "Markdown content block",
          fields: [
            {
              type: "text_input",
              action_id: "body",
              label: "Markdown body",
              placeholder: "# Heading\n\nParagraph text...",
              multiline: true,
            },
          ],
        },
        {
          type: "media",
          label: "Media",
          icon: "link",
          description: "Image with optional CSS layout and adornments",
          fields: [
            { type: "text_input", action_id: "file_url", label: "Image URL", placeholder: "/_emdash/api/media/file/..." },
            { type: "text_input", action_id: "file_alt", label: "Alt text", placeholder: "Describe the image" },
            { type: "text_input", action_id: "width", label: "Width", placeholder: "e.g. 400px or 50%" },
            { type: "text_input", action_id: "height", label: "Max height", placeholder: "e.g. 300px" },
            { type: "text_input", action_id: "padding", label: "Padding", placeholder: "e.g. 10px" },
            { type: "text_input", action_id: "margin", label: "Margin", placeholder: "e.g. 0 auto" },
            { type: "text_input", action_id: "top", label: "Top", placeholder: "e.g. 10px" },
            { type: "text_input", action_id: "right", label: "Right", placeholder: "e.g. 10px" },
            { type: "text_input", action_id: "bottom", label: "Bottom", placeholder: "e.g. 10px" },
            { type: "text_input", action_id: "left", label: "Left", placeholder: "e.g. 10px" },
            { type: "number_input", action_id: "rotation", label: "Rotation (degrees)" },
            { type: "text_input", action_id: "border", label: "Border", placeholder: "e.g. 2px solid black" },
            { type: "text_input", action_id: "filter", label: "CSS filter", placeholder: "e.g. grayscale(100%)" },
            { type: "text_input", action_id: "adornments", label: "Adornments (JSON array)", placeholder: '[{"file":{"url":"...","alt":""},"top":"10px","left":"20px"}]', multiline: true },
          ],
        },
        {
          type: "specialComponent",
          label: "Special Component",
          icon: "link",
          description: "A special built-in component",
          fields: [
            { type: "select", action_id: "type", label: "Component", options: [{ label: "Riso Colors", value: "riso_colors" }] },
          ],
        },
      ],
    },
  });
}

export default createPlugin;
```

- [ ] **Step 2: Update `admin.tsx` — add PageEditor and BlocksFieldRedirect exports**

```typescript
// plugins/content-blocks/src/admin.tsx
import { SidebarEditor } from "./components/SidebarEditor";
import { PageEditor } from "./components/PageEditor";
import { ColorPicker } from "./components/ColorPicker";
import { SidebarFieldRedirect } from "./components/SidebarFieldRedirect";
import { BlocksFieldRedirect } from "./components/BlocksFieldRedirect";

// Pages keyed by path — must match adminPages paths in index.ts
export const pages = {
  "/sidebar": SidebarEditor,
  "/page-editor": PageEditor,
};

// Field widgets keyed by name — must match fieldWidgets names in index.ts
export const fields = {
  colorPicker: ColorPicker,
  sidebarField: SidebarFieldRedirect,
  blocksField: BlocksFieldRedirect,
};
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site && git add plugins/content-blocks/src/index.ts plugins/content-blocks/src/admin.tsx && git commit -m "feat: register page-editor admin page and blocksField widget in content-blocks plugin"
```

---

## Task 2: `BlocksFieldRedirect.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/BlocksFieldRedirect.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/BlocksFieldRedirect.tsx
// Field widget that replaces the portableText blocks field on the standard
// page/homepage editor with a link to the bespoke Page Editor.
import * as React from "react";

interface FieldWidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  id: string;
  required?: boolean;
}

export function BlocksFieldRedirect({ label }: FieldWidgetProps) {
  // Derive entry id and collection from the current URL.
  // Standard EmDash editor URL: /_emdash/admin/content/<collection>/<id>
  const segments = window.location.pathname.split("/").filter(Boolean);
  // segments: ["_emdash", "admin", "content", "<collection>", "<id>"]
  const entryId = segments[segments.length - 1] ?? "";
  const collection = segments[segments.length - 2] ?? "pages";
  const href = `/_emdash/admin/plugins/content-blocks/page-editor?id=${entryId}&collection=${collection}`;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <a
        href={href}
        className="inline-flex items-center gap-2 self-start px-4 py-2 rounded border border-input bg-card text-sm font-medium hover:bg-accent transition-colors"
      >
        Edit in Page Editor →
      </a>
      <p className="text-xs text-muted-foreground">
        This field is managed through the Page Editor.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/BlocksFieldRedirect.tsx && git commit -m "feat: add BlocksFieldRedirect widget for page/homepage blocks fields"
```

---

## Task 3: `SpecialComponentBlock.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/blocks/SpecialComponentBlock.tsx`

- [ ] **Step 1: Create the `blocks/` directory and component**

```typescript
// plugins/content-blocks/src/components/blocks/SpecialComponentBlock.tsx
import * as React from "react";
import type { SpecialComponentBlock as SpecialComponentBlockType } from "@site/types/emdash";

interface Props {
  block: SpecialComponentBlockType;
  onChange: (block: SpecialComponentBlockType) => void;
}

export function SpecialComponentBlock({ block, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded border border-border bg-card">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Special Component</span>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Component type</label>
        <select
          value={block.type}
          onChange={(e) => onChange({ ...block, type: e.target.value as "riso_colors" })}
          className="rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="riso_colors">Riso Colors</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/blocks/ && git commit -m "feat: add SpecialComponentBlock inline editor"
```

---

## Task 4: `RichTextBlock.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/blocks/RichTextBlock.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/blocks/RichTextBlock.tsx
import * as React from "react";
import { marked } from "marked";
import type { RichTextBlock as RichTextBlockType } from "@site/types/emdash";

interface Props {
  block: RichTextBlockType;
  onChange: (block: RichTextBlockType) => void;
}

export function RichTextBlock({ block, onChange }: Props) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.body]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, body: e.target.value });
  };

  const preview = React.useMemo(
    () => ({ __html: marked.parse(block.body ?? "") as string }),
    [block.body]
  );

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rich Text</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border min-h-32" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Left: markdown editor */}
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={block.body ?? ""}
            onChange={handleChange}
            placeholder="# Heading&#10;&#10;Paragraph text..."
            className="w-full resize-none bg-transparent text-sm font-mono focus:outline-none min-h-32 leading-relaxed"
            style={{ height: "auto" }}
          />
        </div>
        {/* Right: live preview */}
        <div
          className="p-3 prose prose-sm max-w-none text-sm overflow-auto"
          dangerouslySetInnerHTML={preview}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/blocks/RichTextBlock.tsx && git commit -m "feat: add RichTextBlock inline editor with markdown/preview split"
```

---

## Task 5: `MediaBlock.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/blocks/MediaBlock.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/blocks/MediaBlock.tsx
import * as React from "react";
import { ImagePicker } from "../ImagePicker";
import { Repeater } from "../Repeater";
import type { MediaBlock as MediaBlockType, AdornmentBlock } from "@site/types/emdash";

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
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function MediaBlock({ block, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const update = (patch: Partial<MediaBlockType>) =>
    onChange({ ...block, ...patch });

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Media</span>
      </div>
      <div className="p-4 flex flex-col gap-4">
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
          className="self-start text-xs px-2 py-1 rounded border border-input hover:bg-accent flex items-center gap-1"
        >
          Advanced layout {showAdvanced ? "▴" : "▾"}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 pl-3 border-l border-border">
            {/* Dimensions & spacing */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Dimensions &amp; spacing</p>
              <div className="grid grid-cols-2 gap-2">
                <LayoutInput label="Width" value={block.width} placeholder="e.g. 400px" onChange={(v) => update({ width: v || undefined })} />
                <LayoutInput label="Height" value={block.height} placeholder="e.g. 30rem" onChange={(v) => update({ height: v || undefined })} />
                <LayoutInput label="Padding" value={block.padding} placeholder="e.g. 1rem" onChange={(v) => update({ padding: v || undefined })} />
                <LayoutInput label="Margin" value={block.margin} placeholder="e.g. 0 auto" onChange={(v) => update({ margin: v || undefined })} />
              </div>
            </div>

            {/* Position */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Position</p>
              <div className="grid grid-cols-2 gap-2">
                <LayoutInput label="Top" value={block.top} placeholder="e.g. 10px" onChange={(v) => update({ top: v || undefined })} />
                <LayoutInput label="Right" value={block.right} placeholder="e.g. 10px" onChange={(v) => update({ right: v || undefined })} />
                <LayoutInput label="Bottom" value={block.bottom} placeholder="e.g. 10px" onChange={(v) => update({ bottom: v || undefined })} />
                <LayoutInput label="Left" value={block.left} placeholder="e.g. 10px" onChange={(v) => update({ left: v || undefined })} />
              </div>
            </div>

            {/* Single-column extras */}
            <div className="flex flex-col gap-2">
              <LayoutInput
                label="Rotation (degrees)"
                value={block.rotation}
                type="number"
                placeholder="e.g. -2"
                onChange={(v) => update({ rotation: v ? Number(v) : undefined })}
              />
              <LayoutInput label="Border" value={block.border} placeholder="e.g. 2px solid black" onChange={(v) => update({ border: v || undefined })} />
              <LayoutInput label="Filter" value={block.filter} placeholder="e.g. grayscale(100%)" onChange={(v) => update({ filter: v || undefined })} />
            </div>

            {/* Adornments */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Adornments</p>
              <Repeater<AdornmentBlock>
                items={block.adornments ?? []}
                onChange={(adornments) => update({ adornments })}
                createItem={() => ({ file: { url: "", alt: null } })}
                addLabel="+ Add adornment"
                renderItem={(adornment, _i, updateAdornment) => (
                  <div className="flex flex-col gap-3 p-3 rounded border border-border bg-background">
                    <ImagePicker
                      label="Adornment image"
                      value={adornment.file?.url ? { url: adornment.file.url, alt: adornment.file.alt ?? "" } : null}
                      onChange={(val) =>
                        updateAdornment({
                          ...adornment,
                          file: val ? { url: val.url, alt: val.alt } : { url: "", alt: null },
                        })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {(["top", "right", "bottom", "left", "width", "height", "padding", "margin"] as const).map((field) => (
                        <LayoutInput
                          key={field}
                          label={field.charAt(0).toUpperCase() + field.slice(1)}
                          value={adornment[field]}
                          placeholder="e.g. 10px"
                          onChange={(v) => updateAdornment({ ...adornment, [field]: v || undefined })}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <LayoutInput
                        label="Rotation (degrees)"
                        value={adornment.rotation}
                        type="number"
                        placeholder="e.g. -25"
                        onChange={(v) => updateAdornment({ ...adornment, rotation: v ? Number(v) : undefined })}
                      />
                      <LayoutInput
                        label="Border"
                        value={adornment.border}
                        placeholder="e.g. 2px solid black"
                        onChange={(v) => updateAdornment({ ...adornment, border: v || undefined })}
                      />
                      <LayoutInput
                        label="Filter"
                        value={adornment.filter}
                        placeholder="e.g. hue-rotate(45deg)"
                        onChange={(v) => updateAdornment({ ...adornment, filter: v || undefined })}
                      />
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/blocks/MediaBlock.tsx && git commit -m "feat: add MediaBlock inline editor with collapsed layout fields and adornments"
```

---

## Task 6: `BlockList.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/BlockList.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/BlockList.tsx
import * as React from "react";
import type { Block, MediaBlock, RichTextBlock, SpecialComponentBlock } from "@site/types/emdash";
import { RichTextBlock as RichTextBlockEditor } from "./blocks/RichTextBlock";
import { MediaBlock as MediaBlockEditor } from "./blocks/MediaBlock";
import { SpecialComponentBlock as SpecialComponentBlockEditor } from "./blocks/SpecialComponentBlock";

interface BlockListProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export function BlockList({ blocks, onChange }: BlockListProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...blocks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const next = [...blocks];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const update = (index: number) => (block: Block) => {
    const next = [...blocks];
    next[index] = block;
    onChange(next);
  };

  const addBlock = (type: Block["_type"]) => {
    setMenuOpen(false);
    const newBlock: Block =
      type === "richText"
        ? { _type: "richText", body: "" }
        : type === "media"
        ? { _type: "media", file: { url: "", alt: null } }
        : { _type: "specialComponent", type: "riso_colors" };
    onChange([...blocks, newBlock]);
  };

  const renderBlock = (block: Block, index: number) => {
    switch (block._type) {
      case "richText":
        return (
          <RichTextBlockEditor
            block={block as RichTextBlock}
            onChange={update(index) as (b: RichTextBlock) => void}
          />
        );
      case "media":
        return (
          <MediaBlockEditor
            block={block as MediaBlock}
            onChange={update(index) as (b: MediaBlock) => void}
          />
        );
      case "specialComponent":
        return (
          <SpecialComponentBlockEditor
            block={block as SpecialComponentBlock}
            onChange={update(index) as (b: SpecialComponentBlock) => void}
          />
        );
      default:
        return (
          <div className="p-3 rounded border border-border text-xs text-muted-foreground">
            Unknown block type: {(block as { _type: string })._type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <div key={index} className="flex gap-2 items-start">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-1 pt-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === blocks.length - 1}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              ↓
            </button>
          </div>
          {/* Block editor */}
          <div className="flex-1 min-w-0">{renderBlock(block, index)}</div>
          {/* Remove button */}
          <button
            type="button"
            onClick={() => remove(index)}
            className="mt-2 flex-shrink-0 text-sm px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
            title="Remove block"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add block menu */}
      <div className="relative self-start" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="text-sm px-3 py-1.5 rounded border border-input hover:bg-accent flex items-center gap-1"
        >
          + Add block {menuOpen ? "▴" : "▾"}
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-border rounded shadow-md min-w-40 flex flex-col">
            <button
              type="button"
              onClick={() => addBlock("richText")}
              className="px-4 py-2 text-sm text-left hover:bg-accent"
            >
              Rich Text
            </button>
            <button
              type="button"
              onClick={() => addBlock("media")}
              className="px-4 py-2 text-sm text-left hover:bg-accent"
            >
              Media
            </button>
            <button
              type="button"
              onClick={() => addBlock("specialComponent")}
              className="px-4 py-2 text-sm text-left hover:bg-accent"
            >
              Special Component
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/BlockList.tsx && git commit -m "feat: add BlockList component with inline add/remove/reorder and block dispatch"
```

---

## Task 7: `PageEditor.tsx`

**Files:**
- Create: `plugins/content-blocks/src/components/PageEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/PageEditor.tsx
import * as React from "react";
import {
  fetchContent,
  fetchContentList,
  updateContent,
  publishContent,
} from "@emdash-cms/admin";
import type { Block } from "@site/types/emdash";
import { BlockList } from "./BlockList";

interface SaveBarProps {
  saving: boolean;
  saveStatus: "idle" | "saved" | "error";
  onSave: () => void;
  disabled: boolean;
  sticky?: boolean;
}

function SaveBar({ saving, saveStatus, onSave, disabled, sticky }: SaveBarProps) {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${
        sticky
          ? "sticky top-0 z-10 bg-background border-b border-border"
          : "border-t border-border mt-4 pt-4"
      }`}
    >
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save & Publish"}
      </button>
      {saveStatus === "saved" && (
        <span className="text-sm text-green-600 font-medium">Saved!</span>
      )}
      {saveStatus === "error" && (
        <span className="text-sm text-destructive font-medium">Save failed</span>
      )}
    </div>
  );
}

interface PageListItem {
  id: string;
  slug: string | null;
  data: Record<string, unknown>;
}

function PageList() {
  const [pages, setPages] = React.useState<PageListItem[]>([]);
  const [homepage, setHomepage] = React.useState<PageListItem | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetchContentList("pages", { limit: 250 }),
      fetchContentList("homepage", { limit: 1 }),
    ])
      .then(([pagesResult, homepageResult]) => {
        setPages(pagesResult.items as PageListItem[]);
        setHomepage((homepageResult.items[0] as PageListItem) ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading pages…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Page Editor</h1>
      <p className="text-sm text-muted-foreground">
        Select a page to edit its blocks. To edit title, slug, or SEO, use the standard content editor.
      </p>

      {homepage && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Homepage</h2>
          <a
            href={`/_emdash/admin/plugins/content-blocks/page-editor?id=${homepage.id}&collection=homepage`}
            className="px-4 py-3 rounded border border-border hover:bg-accent text-sm font-medium"
          >
            Homepage
          </a>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pages</h2>
        {pages.length === 0 && (
          <p className="text-sm text-muted-foreground">No pages found.</p>
        )}
        {pages.map((page) => (
          <a
            key={page.id}
            href={`/_emdash/admin/plugins/content-blocks/page-editor?id=${page.id}&collection=pages`}
            className="px-4 py-3 rounded border border-border hover:bg-accent text-sm font-medium"
          >
            {(page.data?.page_slug as string) || page.slug || page.id}
          </a>
        ))}
      </section>
    </div>
  );
}

export function PageEditor() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const collection = (params.get("collection") ?? "pages") as "pages" | "homepage";

  // No id — show page list
  if (!id) {
    return <PageList />;
  }

  return <PageEditorInner id={id} collection={collection} />;
}

interface InnerProps {
  id: string;
  collection: "pages" | "homepage";
}

function PageEditorInner({ id, collection }: InnerProps) {
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [title, setTitle] = React.useState("");
  const [originalData, setOriginalData] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchContent(collection, id)
      .then((item) => {
        const data = item.data as Record<string, unknown>;
        setOriginalData(data);
        setBlocks((data.blocks as Block[]) ?? []);
        setTitle(
          (data.page_slug as string) ||
          (data.title as string) ||
          item.slug ||
          id
        );
      })
      .catch((err) => setErrorMsg(String(err)))
      .finally(() => setLoading(false));
  }, [id, collection]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setErrorMsg(null);
    try {
      await updateContent(collection, id, {
        data: { ...originalData, blocks },
      });
      await publishContent(collection, id);
      // Keep originalData in sync after save
      setOriginalData((prev) => ({ ...prev, blocks }));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg(String(err));
    } finally {
      setSaving(false);
    }
  };

  const backHref = `/_emdash/admin/content/${collection}/${id}`;

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  if (errorMsg && blocks.length === 0) {
    return (
      <div className="p-6 text-destructive">Failed to load page: {errorMsg}</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <SaveBar
        sticky
        saving={saving}
        saveStatus={saveStatus}
        onSave={handleSave}
        disabled={saving}
      />

      <div className="flex items-center gap-3">
        <a
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to {title}
        </a>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>

      <BlockList blocks={blocks} onChange={setBlocks} />

      {saveStatus === "error" && errorMsg && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      <SaveBar
        saving={saving}
        saveStatus={saveStatus}
        onSave={handleSave}
        disabled={saving}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/PageEditor.tsx && git commit -m "feat: add PageEditor page with inline block editing, fallback page list, and save/publish"
```

---

## Task 8: Wire `blocksField` widget to pages and homepage in the DB

The dev server must be running for this step — it needs to already have the `blocksField` widget registered (Tasks 1–7 must be complete first).

- [ ] **Step 1: Restart the dev server to pick up admin.tsx changes**

```bash
pkill -f "astro dev" 2>/dev/null; sleep 1 && cd /Users/jack/repos/personal/andrew-gosse-site && npm run dev &
sleep 12
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/
```

Expected: `200`

- [ ] **Step 2: Set the blocksField widget on pages.blocks and homepage.blocks**

```bash
sqlite3 /Users/jack/repos/personal/andrew-gosse-site/data/emdash.db "
UPDATE _emdash_fields SET widget = 'content-blocks:blocksField'
WHERE slug = 'blocks'
AND collection_id IN (
  SELECT id FROM _emdash_collections WHERE slug IN ('pages', 'homepage')
);
SELECT c.slug as collection, f.slug as field, f.widget
FROM _emdash_fields f
JOIN _emdash_collections c ON c.id = f.collection_id
WHERE f.slug = 'blocks';
"
```

Expected output:
```
collection|field|widget
pages|blocks|content-blocks:blocksField
homepage|blocks|content-blocks:blocksField
```

- [ ] **Step 3: Verify the redirect widget shows on the standard page editor**

Navigate to `http://localhost:4321/_emdash/api/auth/dev-bypass?redirect=/_emdash/admin/content/pages/01KNDN036316RW88M4XXQS4BP2`

The `Blocks` field should show "Edit in Page Editor →" instead of the TipTap editor.

- [ ] **Step 4: Verify the page editor loads**

Click "Edit in Page Editor →" or navigate directly to:
```
http://localhost:4321/_emdash/admin/plugins/content-blocks/page-editor?id=01KNDN036316RW88M4XXQS4BP2&collection=pages
```

Expected: the page loads showing all blocks inline — rich text blocks with split markdown/preview, media blocks with image picker and "Advanced layout ▾" toggle.

- [ ] **Step 5: Test saving**

Edit the body of a rich text block. Click "Save & Publish". Confirm "Saved!" appears. Reload `http://localhost:4321/about` and confirm the change is live.

- [ ] **Step 6: Commit**

```bash
git -C /Users/jack/repos/personal/andrew-gosse-site commit --allow-empty -m "chore: wire blocksField widget to pages.blocks and homepage.blocks"
```

---

## Task 9: Verify the fallback page list

- [ ] **Step 1: Navigate to the page editor without an id param**

```
http://localhost:4321/_emdash/admin/plugins/content-blocks/page-editor
```

Expected: a list of all pages by slug with clickable links, plus a "Homepage" link at the top.

- [ ] **Step 2: Navigate via "Page Editor" in the PLUGINS nav**

In the EmDash admin sidebar, under PLUGINS, click "Page Editor". Should land on the same fallback list.

- [ ] **Step 3: Commit (empty if no changes)**

```bash
git -C /Users/jack/repos/personal/andrew-gosse-site commit --allow-empty -m "chore: verify page editor fallback list and nav"
```
