// src/tea/admin/components/PageList.tsx
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface PageSummary {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
}

export function PageList() {
  const navigate = useNavigate();
  const [items, setItems] = React.useState<PageSummary[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [newSlug, setNewSlug] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");

  const load = () => {
    api.get<{ items: PageSummary[] }>("/pages").then((r) => setItems(r.items));
  };

  React.useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const slug = newSlug.trim();
    const title = newTitle.trim();
    if (!slug || !title) return;
    await api.post("/pages", { slug, title });
    setCreating(false);
    setNewSlug("");
    setNewTitle("");
    navigate(`/tea/admin/pages/${slug}`);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete page "${slug}"?`)) return;
    await api.delete(`/pages/${slug}`);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pages</h1>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            + New page
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="page-slug"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Page title"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newSlug.trim() || !newTitle.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewSlug("");
                setNewTitle("");
              }}
              className="px-4 py-2 rounded-md border border-input text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No pages yet.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <Link
                to={`/tea/admin/pages/${item.slug}`}
                className="flex flex-col flex-1 hover:bg-accent -mx-4 px-4 py-1 rounded transition-colors"
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground font-mono">/{item.slug}</span>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(item.slug)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
