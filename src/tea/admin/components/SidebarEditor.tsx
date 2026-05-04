// src/tea/admin/components/SidebarEditor.tsx
import * as React from "react";
import { api } from "../lib/api";
import { ImagePicker } from "./shared/ImagePicker";
import { Repeater } from "./shared/Repeater";

interface SidebarItem {
  text: string;
  pageSlug: string;
}

interface SidebarCategory {
  categoryTitle: string;
  backgroundImageId: string | null;
  items: SidebarItem[];
}

interface SidebarLink {
  service: string;
  url: string;
}

interface Sidebar {
  top_image_id: string | null;
  categories: SidebarCategory[];
  links: SidebarLink[];
}

interface MediaItem {
  id: string;
  url: string;
  alt: string | null;
}

export function SidebarEditor() {
  const [sidebar, setSidebar] = React.useState<Sidebar | null>(null);
  const [topImage, setTopImage] = React.useState<{ mediaId: string; url: string; alt: string } | null>(null);
  const [categoryImages, setCategoryImages] = React.useState<Record<string, { url: string; alt: string }>>({});
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    Promise.all([
      api.get<{ item: Sidebar }>("/sidebar"),
      api.get<{ items: MediaItem[] }>("/media"),
    ]).then(([s, m]) => {
      setSidebar(s.item);
      if (s.item.top_image_id) {
        const media = m.items.find((mi) => mi.id === s.item.top_image_id);
        if (media) {
          setTopImage({ mediaId: media.id, url: media.url, alt: media.alt ?? "" });
        }
      }
      const map: Record<string, { url: string; alt: string }> = {};
      for (const item of m.items) {
        map[item.id] = { url: item.url, alt: item.alt ?? "" };
      }
      setCategoryImages(map);
    });
  }, []);

  React.useEffect(() => {
    if (!sidebar) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put("/sidebar", {
          top_image_id: sidebar.top_image_id,
          categories: sidebar.categories,
          links: sidebar.links,
        });
        setSavedAt(Date.now());
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [sidebar]);

  if (!sidebar) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sidebar</h1>
        <span className="text-xs text-muted-foreground">
          {saving ? "Saving…" : savedAt ? "Saved" : ""}
        </span>
      </div>

      <section>
        <ImagePicker
          label="Top image"
          value={topImage}
          onChange={(v) => {
            setTopImage(v);
            setSidebar({ ...sidebar, top_image_id: v?.mediaId ?? null });
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categories</h2>
        <Repeater<SidebarCategory>
          items={sidebar.categories}
          onChange={(categories) => setSidebar({ ...sidebar, categories })}
          createItem={() => ({ categoryTitle: "", backgroundImageId: null, items: [] })}
          addLabel="+ Add category"
          renderItem={(cat, _i, update) => (
            <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
              <input
                type="text"
                value={cat.categoryTitle}
                onChange={(e) => update({ ...cat, categoryTitle: e.target.value })}
                placeholder="Category title"
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Background image (optional)</p>
                {cat.backgroundImageId && categoryImages[cat.backgroundImageId] ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={categoryImages[cat.backgroundImageId].url}
                      alt=""
                      className="h-12 w-12 rounded border border-input object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => update({ ...cat, backgroundImageId: null })}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await api.get<{ items: MediaItem[] }>("/media");
                      const url = window.prompt(
                        `Pick a media id from:\n${r.items.map((m) => `${m.id} — ${m.alt ?? m.id}`).join("\n")}`,
                        ""
                      );
                      if (url) update({ ...cat, backgroundImageId: url });
                    }}
                    className="text-xs px-2 py-1 rounded border border-input hover:bg-accent"
                  >
                    Pick image
                  </button>
                )}
              </div>
              <Repeater<SidebarItem>
                items={cat.items}
                onChange={(items) => update({ ...cat, items })}
                createItem={() => ({ text: "", pageSlug: "" })}
                addLabel="+ Add item"
                renderItem={(item, _j, updateItem) => (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateItem({ ...item, text: e.target.value })}
                      placeholder="Display text"
                      className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={item.pageSlug}
                      onChange={(e) => updateItem({ ...item, pageSlug: e.target.value })}
                      placeholder="page-slug"
                      className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              />
            </div>
          )}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Social links</h2>
        <Repeater<SidebarLink>
          items={sidebar.links}
          onChange={(links) => setSidebar({ ...sidebar, links })}
          createItem={() => ({ service: "", url: "" })}
          addLabel="+ Add link"
          renderItem={(link, _i, update) => (
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={link.service}
                onChange={(e) => update({ ...link, service: e.target.value })}
                placeholder="Service"
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => update({ ...link, url: e.target.value })}
                placeholder="https://…"
                className="col-span-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        />
      </section>
    </div>
  );
}
