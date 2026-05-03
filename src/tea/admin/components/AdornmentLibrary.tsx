// src/tea/admin/components/AdornmentLibrary.tsx
import * as React from "react";
import { api } from "../lib/api";
import { ImagePicker } from "./shared/ImagePicker";

interface AdornmentCss {
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

interface AdornmentItem {
  id: string;
  name: string;
  media_id: string | null;
  css: AdornmentCss;
}

interface MediaItem {
  id: string;
  url: string;
  alt: string | null;
}

const CSS_KEYS: Array<keyof AdornmentCss> = [
  "width", "height", "padding", "margin",
  "top", "right", "bottom", "left",
  "rotation", "border", "filter",
];

export function AdornmentLibrary() {
  const [items, setItems] = React.useState<AdornmentItem[]>([]);
  const [media, setMedia] = React.useState<Record<string, MediaItem>>({});
  const [editing, setEditing] = React.useState<AdornmentItem | null>(null);
  const [creating, setCreating] = React.useState(false);

  const load = async () => {
    const [a, m] = await Promise.all([
      api.get<{ items: AdornmentItem[] }>("/adornments"),
      api.get<{ items: MediaItem[] }>("/media"),
    ]);
    setItems(a.items);
    const map: Record<string, MediaItem> = {};
    for (const item of m.items) map[item.id] = item;
    setMedia(map);
  };

  React.useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditing({ id: "", name: "", media_id: null, css: {} });
    setCreating(true);
  };

  const startEdit = (item: AdornmentItem) => {
    setEditing({ ...item });
    setCreating(false);
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    if (creating) {
      await api.post("/adornments", {
        name: editing.name,
        media_id: editing.media_id,
        css: editing.css,
      });
    } else {
      await api.put(`/adornments/${editing.id}`, {
        name: editing.name,
        media_id: editing.media_id,
        css: editing.css,
      });
    }
    setEditing(null);
    setCreating(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete adornment?")) return;
    await api.delete(`/adornments/${id}`);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Adornments</h1>
        {!editing && (
          <button
            type="button"
            onClick={startCreate}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            + New adornment
          </button>
        )}
      </div>

      {editing && (
        <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-4">
          <h2 className="text-base font-semibold">
            {creating ? "New adornment" : "Edit adornment"}
          </h2>
          <input
            type="text"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Name"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <ImagePicker
            label="Image"
            value={
              editing.media_id && media[editing.media_id]
                ? {
                    mediaId: editing.media_id,
                    url: media[editing.media_id].url,
                    alt: media[editing.media_id].alt ?? "",
                  }
                : null
            }
            onChange={(v) => setEditing({ ...editing, media_id: v?.mediaId ?? null })}
          />
          <div className="grid grid-cols-2 gap-3">
            {CSS_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{key}</label>
                <input
                  type={key === "rotation" ? "number" : "text"}
                  value={editing.css[key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const css = { ...editing.css };
                    if (!v) {
                      delete css[key];
                    } else if (key === "rotation") {
                      css[key] = Number(v);
                    } else {
                      (css[key] as string) = v;
                    }
                    setEditing({ ...editing, css });
                  }}
                  placeholder={key === "rotation" ? "-25" : "e.g. 2rem"}
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!editing.name.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 rounded-md border border-input text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
          const m = item.media_id ? media[item.media_id] : null;
          const rot = typeof item.css.rotation === "number" ? item.css.rotation : 0;
          return (
            <div
              key={item.id}
              className="rounded-md border border-border bg-card p-3 flex flex-col gap-2"
            >
              <div className="h-20 flex items-center justify-center bg-muted/30 rounded overflow-hidden">
                {m ? (
                  <img
                    src={m.url}
                    alt={m.alt ?? item.name}
                    style={{
                      height: item.css.height ?? "auto",
                      maxHeight: "5rem",
                      maxWidth: "100%",
                      transform: rot !== 0 ? `rotate(${rot}deg)` : undefined,
                      filter: item.css.filter,
                    }}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No image</span>
                )}
              </div>
              <div className="text-xs font-medium truncate" title={item.name}>
                {item.name}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="flex-1 text-xs px-2 py-1 rounded border border-input hover:bg-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="flex-1 text-xs px-2 py-1 rounded border border-input text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
