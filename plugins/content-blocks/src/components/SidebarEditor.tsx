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
