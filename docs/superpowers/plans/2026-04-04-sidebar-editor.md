# Sidebar Editor & Colour Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom React admin page to the `content-blocks` plugin that lets non-dev users edit the sidebar (top image, categories, nav items, links), plus a colour picker field widget for the site background colour.

**Architecture:** The existing `content-blocks` plugin at `plugins/content-blocks/` gains a new `src/admin.tsx` entry point exporting a `SidebarEditor` React page and a `ColorPicker` field widget. The plugin descriptor is updated to declare these. No new plugin is created, no changes to `Sidebar.astro` or `fetch-emdash.ts` — the data shape in the DB is unchanged.

**Tech Stack:** React 19, `@emdash-cms/admin` (fetchContentList, updateContent, publishContent, MediaPickerModal), Tailwind v4 utility classes, TypeScript.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `plugins/content-blocks/package.json` | Add `"./admin"` export |
| Modify | `plugins/content-blocks/src/index.ts` | Add adminEntry, adminPages, fieldWidgets to descriptor + createPlugin |
| Create | `plugins/content-blocks/src/admin.tsx` | Root admin entry — exports `pages` and `fields` maps |
| Create | `plugins/content-blocks/src/components/Repeater.tsx` | Generic up/down/add/remove list |
| Create | `plugins/content-blocks/src/components/ImagePicker.tsx` | MediaPickerModal wrapper |
| Create | `plugins/content-blocks/src/components/ColorPicker.tsx` | Colour field widget |
| Create | `plugins/content-blocks/src/components/SidebarEditor.tsx` | Full sidebar editing page |

---

## Task 1: Add `./admin` package export and update plugin descriptor

**Files:**
- Modify: `plugins/content-blocks/package.json`
- Modify: `plugins/content-blocks/src/index.ts`

- [ ] **Step 1: Add `./admin` export to package.json**

```json
{
  "name": "@andrew-gosse-site/plugin-content-blocks",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./astro": "./src/astro/index.ts",
    "./admin": "./src/admin.tsx"
  },
  "peerDependencies": {
    "astro": ">=6.0.0-beta.0",
    "emdash": "^0.1.0"
  }
}
```

- [ ] **Step 2: Update `index.ts` — add adminEntry, adminPages, fieldWidgets**

Replace the entire file:

```typescript
import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

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
      fieldWidgets: [
        { name: "colorPicker", label: "Color Picker", fieldTypes: ["string"] },
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
            {
              type: "text_input",
              action_id: "file_url",
              label: "Image URL",
              placeholder: "/_emdash/api/media/file/...",
            },
            {
              type: "text_input",
              action_id: "file_alt",
              label: "Alt text",
              placeholder: "Describe the image",
            },
            {
              type: "text_input",
              action_id: "width",
              label: "Width",
              placeholder: "e.g. 400px or 50%",
            },
            {
              type: "text_input",
              action_id: "height",
              label: "Max height",
              placeholder: "e.g. 300px",
            },
            {
              type: "text_input",
              action_id: "padding",
              label: "Padding",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "margin",
              label: "Margin",
              placeholder: "e.g. 0 auto",
            },
            {
              type: "text_input",
              action_id: "top",
              label: "Top",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "right",
              label: "Right",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "bottom",
              label: "Bottom",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "left",
              label: "Left",
              placeholder: "e.g. 10px",
            },
            {
              type: "number_input",
              action_id: "rotation",
              label: "Rotation (degrees)",
            },
            {
              type: "text_input",
              action_id: "border",
              label: "Border",
              placeholder: "e.g. 2px solid black",
            },
            {
              type: "text_input",
              action_id: "filter",
              label: "CSS filter",
              placeholder: "e.g. grayscale(100%)",
            },
            {
              type: "text_input",
              action_id: "adornments",
              label: "Adornments (JSON array)",
              placeholder: '[{"file":{"url":"...","alt":""},"top":"10px","left":"20px"}]',
              multiline: true,
            },
          ],
        },
        {
          type: "specialComponent",
          label: "Special Component",
          icon: "link",
          description: "A special built-in component",
          fields: [
            {
              type: "select",
              action_id: "type",
              label: "Component",
              options: [{ label: "Riso Colors", value: "riso_colors" }],
            },
          ],
        },
      ],
    },
  });
}

export default createPlugin;
```

- [ ] **Step 3: Verify dev server still starts**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site && npm run dev
```

Expected: server starts, no errors about missing `./admin` export (it doesn't exist yet — that's fine, Vite will warn but not crash).

- [ ] **Step 4: Commit**

```bash
git add plugins/content-blocks/ && git commit -m "feat: add adminEntry and fieldWidgets to content-blocks plugin descriptor"
```

---

## Task 2: `Repeater.tsx` — generic up/down/add/remove list

**Files:**
- Create: `plugins/content-blocks/src/components/Repeater.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/Repeater.tsx
import * as React from "react";

interface RepeaterProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    update: (item: T) => void
  ) => React.ReactNode;
  createItem: () => T;
  addLabel: string;
}

export function Repeater<T>({
  items,
  onChange,
  renderItem,
  createItem,
  addLabel,
}: RepeaterProps<T>) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const update = (index: number) => (item: T) => {
    const next = [...items];
    next[index] = item;
    onChange(next);
  };

  const add = () => {
    onChange([...items, createItem()]);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex flex-col gap-1 pt-1">
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
              disabled={index === items.length - 1}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <div className="flex-1">{renderItem(item, index, update(index))}</div>
          <button
            type="button"
            onClick={() => remove(index)}
            className="mt-1 text-sm px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-sm px-3 py-1.5 rounded border border-input hover:bg-accent"
      >
        {addLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/Repeater.tsx && git commit -m "feat: add Repeater component to content-blocks plugin"
```

---

## Task 3: `ImagePicker.tsx` — media picker wrapper

**Files:**
- Create: `plugins/content-blocks/src/components/ImagePicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/ImagePicker.tsx
import * as React from "react";
import { MediaPickerModal } from "@emdash-cms/admin";
import type { MediaItem } from "@emdash-cms/admin";

interface ImageValue {
  url: string;
  alt: string;
}

interface ImagePickerProps {
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  label: string;
}

export function ImagePicker({ value, onChange, label }: ImagePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (item: MediaItem) => {
    onChange({ url: item.url, alt: item.filename });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {value?.url ? (
          <img
            src={value.url}
            alt={value.alt}
            className="h-16 w-16 rounded border border-input object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded border border-dashed border-input flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">
            No image
          </div>
        )}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm px-3 py-1.5 rounded border border-input hover:bg-accent"
          >
            {value ? "Change" : "Select image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {value && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Alt text</label>
          <input
            type="text"
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="Describe the image"
            className="w-full rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
      <MediaPickerModal
        open={open}
        onOpenChange={setOpen}
        onSelect={handleSelect}
        mimeTypeFilter="image/"
        title={label}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/ImagePicker.tsx && git commit -m "feat: add ImagePicker component to content-blocks plugin"
```

---

## Task 4: `ColorPicker.tsx` — colour field widget

**Files:**
- Create: `plugins/content-blocks/src/components/ColorPicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/ColorPicker.tsx
import * as React from "react";

interface FieldWidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  id: string;
  required?: boolean;
}

const VALID_HEX = /^#[\da-f]{6}$/i;

export function ColorPicker({ value, onChange, label, id, required }: FieldWidgetProps) {
  const raw = typeof value === "string" && value ? value : "#ffffff";
  const safe = VALID_HEX.test(raw) ? raw : "#ffffff";

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium leading-none mb-1.5 block">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          id={id}
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border border-input p-0.5"
        />
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="flex h-10 w-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div
          className="h-10 flex-1 rounded-md border border-input"
          style={{ backgroundColor: safe }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/ColorPicker.tsx && git commit -m "feat: add ColorPicker field widget to content-blocks plugin"
```

---

## Task 5: `SidebarEditor.tsx` — full sidebar editing page

**Files:**
- Create: `plugins/content-blocks/src/components/SidebarEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
// plugins/content-blocks/src/components/SidebarEditor.tsx
import * as React from "react";
import {
  fetchContentList,
  updateContent,
  publishContent,
} from "@emdash-cms/admin";
import { ImagePicker } from "./ImagePicker";
import { Repeater } from "./Repeater";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageValue {
  url: string;
  alt: string;
}

interface NavItem {
  text: string;
  page: { slug: string };
}

interface Category {
  categoryTitle: string;
  backgroundImage: ImageValue | null;
  items: NavItem[];
}

interface SocialLink {
  service: string;
  url: string;
}

interface SidebarState {
  id: string;
  topImage: ImageValue | null;
  categories: Category[];
  links: SocialLink[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SidebarEditor() {
  const [state, setState] = React.useState<SidebarState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Load on mount
  React.useEffect(() => {
    fetchContentList("sidebar", { limit: 1 })
      .then((result) => {
        const item = result.items[0];
        if (!item) throw new Error("No sidebar entry found");
        const d = item.data as Record<string, unknown>;
        setState({
          id: item.id,
          topImage: (d.top_image as ImageValue | null) ?? null,
          categories: (d.categories as Category[] | null) ?? [],
          links: (d.links as SocialLink[] | null) ?? [],
        });
      })
      .catch((err) => {
        setErrorMsg(String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!state) return;
    setSaving(true);
    setSaveStatus("idle");
    setErrorMsg(null);
    try {
      await updateContent("sidebar", state.id, {
        data: {
          top_image: state.topImage,
          categories: state.categories,
          links: state.links,
        },
      });
      await publishContent("sidebar", state.id);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg(String(err));
    } finally {
      setSaving(false);
    }
  };

  const SaveBar = ({ sticky }: { sticky?: boolean }) => (
    <div
      className={`flex items-center gap-3 py-3 ${sticky ? "sticky top-0 z-10 bg-background border-b border-border" : "border-t border-border mt-4 pt-4"}`}
    >
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !state}
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

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading sidebar…</div>;
  }

  if (errorMsg && !state) {
    return (
      <div className="p-6 text-destructive">
        Failed to load sidebar: {errorMsg}
      </div>
    );
  }

  if (!state) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
      <SaveBar sticky />

      {/* Top Image */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Top Image</h2>
        <ImagePicker
          label="Profile image"
          value={state.topImage}
          onChange={(topImage) => setState({ ...state, topImage })}
        />
      </section>

      {/* Categories */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Repeater<Category>
          items={state.categories}
          onChange={(categories) => setState({ ...state, categories })}
          createItem={() => ({ categoryTitle: "", backgroundImage: null, items: [] })}
          addLabel="+ Add category"
          renderItem={(category, _index, update) => (
            <div className="flex flex-col gap-3 p-4 rounded border border-border bg-card">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Category title</label>
                <input
                  type="text"
                  value={category.categoryTitle}
                  onChange={(e) => update({ ...category, categoryTitle: e.target.value })}
                  placeholder="e.g. Music"
                  className="w-full rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <ImagePicker
                label="Background image"
                value={category.backgroundImage}
                onChange={(backgroundImage) => update({ ...category, backgroundImage })}
              />
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-medium">Nav items</span>
                {category.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        const items = [...category.items];
                        items[i] = { ...item, text: e.target.value };
                        update({ ...category, items });
                      }}
                      placeholder="Display text"
                      className="flex-1 rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={item.page.slug}
                      onChange={(e) => {
                        const items = [...category.items];
                        items[i] = { ...item, page: { slug: e.target.value } };
                        update({ ...category, items });
                      }}
                      placeholder="page-slug"
                      className="w-32 rounded border border-input bg-transparent px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const items = category.items.filter((_, j) => j !== i);
                        update({ ...category, items });
                      }}
                      className="text-sm px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
                      title="Remove item"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const items = [...category.items, { text: "", page: { slug: "" } }];
                    update({ ...category, items });
                  }}
                  className="self-start text-xs px-2 py-1 rounded border border-input hover:bg-accent"
                >
                  + Add item
                </button>
              </div>
            </div>
          )}
        />
      </section>

      {/* Links */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Social Links</h2>
        <Repeater<SocialLink>
          items={state.links}
          onChange={(links) => setState({ ...state, links })}
          createItem={() => ({ service: "", url: "" })}
          addLabel="+ Add link"
          renderItem={(link, _index, update) => (
            <div className="flex gap-2">
              <input
                type="text"
                value={link.service}
                onChange={(e) => update({ ...link, service: e.target.value })}
                placeholder="Service name"
                className="w-32 rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => update({ ...link, url: e.target.value })}
                placeholder="https://..."
                className="flex-1 rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        />
      </section>

      {saveStatus === "error" && errorMsg && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      <SaveBar />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/content-blocks/src/components/SidebarEditor.tsx && git commit -m "feat: add SidebarEditor page to content-blocks plugin"
```

---

## Task 6: `admin.tsx` — wire everything together

**Files:**
- Create: `plugins/content-blocks/src/admin.tsx`

- [ ] **Step 1: Create admin.tsx**

```typescript
// plugins/content-blocks/src/admin.tsx
import { SidebarEditor } from "./components/SidebarEditor";
import { ColorPicker } from "./components/ColorPicker";

// Pages keyed by path — must match adminPages paths in index.ts
export const pages = {
  "/sidebar": SidebarEditor,
};

// Field widgets keyed by name — must match fieldWidgets names in index.ts
export const fields = {
  colorPicker: ColorPicker,
};
```

- [ ] **Step 2: Start the dev server and verify no import errors**

```bash
cd /Users/jack/repos/personal/andrew-gosse-site && npm run dev
```

Expected: server starts cleanly. Navigate to `http://localhost:4321/_emdash/admin` — the sidebar nav should now have a "Sidebar" link under Plugins → content-blocks (or directly in the nav depending on how EmDash renders plugin pages).

- [ ] **Step 3: Navigate to the sidebar editor**

Open `http://localhost:4321/_emdash/admin/plugins/content-blocks/sidebar` — you should see the Sidebar Editor UI with the top image, categories (empty titles but populated items), and social links loaded from the DB.

- [ ] **Step 4: Commit**

```bash
git add plugins/content-blocks/src/admin.tsx && git commit -m "feat: wire admin.tsx entry point for content-blocks plugin"
```

---

## Task 7: Wire the colour picker to `background_color` in the schema builder

This is a manual step in the EmDash admin UI. The dev server must be running.

- [ ] **Step 1: Navigate to content types**

Open `http://localhost:4321/_emdash/admin/content-types` and select the `site` collection.

- [ ] **Step 2: Edit the `background_color` field**

Find the `background_color` field and click to edit it. Look for a "Widget" or "Display" option. Set the widget to `content-blocks:colorPicker`.

Save the schema change.

- [ ] **Step 3: Verify the colour picker appears**

Navigate to `http://localhost:4321/_emdash/admin/content/site/` and open the site entry. The `background_color` field should now show a colour swatch + hex input instead of a plain text box.

- [ ] **Step 4: Commit an empty marker commit**

```bash
git -C /Users/jack/repos/personal/andrew-gosse-site commit --allow-empty -m "chore: wire colorPicker widget to site.background_color in EmDash schema"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Edit a category title in the sidebar editor**

Open `http://localhost:4321/_emdash/admin/plugins/content-blocks/sidebar`. Fill in the first category title (currently empty). Click "Save & Publish". Confirm the "Saved!" message appears.

- [ ] **Step 2: Verify the change appears on the live site**

Open `http://localhost:4321/` in a new tab. The sidebar should show the updated category title.

- [ ] **Step 3: Edit the top image**

In the sidebar editor, click "Change" on the top image. Select a different image from the media library. Save & Publish. Reload the homepage and confirm the new image appears.

- [ ] **Step 4: Add and remove a social link**

Click "+ Add link", fill in a service name and URL. Save & Publish. Reload the homepage and confirm it appears in the sidebar. Then remove it, save again, and confirm it's gone.

- [ ] **Step 5: Check the colour picker saves**

Open `http://localhost:4321/_emdash/admin/content/site/` → site entry. Change the background colour using the picker. Click Publish. Reload `http://localhost:4321/` — the background colour should update.

- [ ] **Step 6: Commit**

```bash
git -C /Users/jack/repos/personal/andrew-gosse-site add -A && git commit -m "chore: end-to-end verification of sidebar editor and colour picker"
```

(Only if there are any file changes from this task — likely none.)
