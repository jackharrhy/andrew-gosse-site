// src/tea/admin/components/MediaBrowser.tsx
import * as React from "react";
import { api } from "../lib/api";

interface MediaItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
  alt: string | null;
}

interface BrowserProps {
  mode?: "browse" | "picker";
  onSelect?: (item: MediaItem) => void;
  onClose?: () => void;
}

export function MediaBrowser({ mode = "browse", onSelect, onClose }: BrowserProps) {
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api
      .get<{ items: MediaItem[] }>("/media")
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post<{ item: MediaItem }>("/media", fd);
      load();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    await api.delete(`/media/${id}`);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Upload image"}
        </button>
        {mode === "picker" && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm hover:bg-accent"
          >
            Cancel
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground text-sm py-8 text-center border border-dashed border-border rounded-md">
          No media yet. Upload an image to get started.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-border bg-card p-2 flex flex-col gap-2"
            >
              <button
                type="button"
                onClick={() => onSelect?.(item)}
                disabled={mode !== "picker"}
                className="aspect-square bg-muted rounded overflow-hidden flex items-center justify-center hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
              >
                <img
                  src={item.url}
                  alt={item.alt ?? item.filename}
                  className="max-w-full max-h-full object-contain"
                />
              </button>
              <div className="text-xs truncate" title={item.filename}>
                {item.filename}
              </div>
              {mode === "browse" && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-muted-foreground hover:text-destructive text-left"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaBrowserPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Media</h1>
      <MediaBrowser mode="browse" />
    </div>
  );
}
