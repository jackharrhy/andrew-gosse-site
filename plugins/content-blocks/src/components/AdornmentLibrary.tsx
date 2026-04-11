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

          <ImagePicker
            label="Image"
            value={form.file}
            onChange={(v) => updateForm({ file: v })}
          />

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
                      <button type="button" onClick={() => handleDelete(item.id)}
                        className="flex-1 text-xs px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10">
                        Remove
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(null)}
                        className="flex-1 text-xs px-2 py-1 rounded border border-input hover:bg-accent">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => openEdit(item)}
                      className="flex-1 text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors">
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(item.id)}
                      className="flex-1 text-xs px-2 py-1 rounded border border-input text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors">
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
