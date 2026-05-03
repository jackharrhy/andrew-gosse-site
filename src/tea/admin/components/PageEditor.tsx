// src/tea/admin/components/PageEditor.tsx
import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { api } from "../lib/api";
import { teaBlockSchema } from "./blocks/schema";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  blocks: unknown[];
  seo: {
    title: string | null;
    description: string | null;
    image_id: string | null;
    no_index: boolean;
    canonical: string | null;
  };
}

export function PageEditor() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = React.useState<PageItem | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const editor = useCreateBlockNote({
    schema: teaBlockSchema,
  });

  React.useEffect(() => {
    if (!slug) return;
    api
      .get<{ item: PageItem }>(`/pages/${slug}`)
      .then((r) => {
        setPage(r.item);
        if (r.item.blocks && Array.isArray(r.item.blocks) && r.item.blocks.length > 0) {
          editor.replaceBlocks(
            editor.document,
            r.item.blocks as Parameters<typeof editor.replaceBlocks>[1]
          );
        }
      })
      .catch(() => setPage(null));
  }, [slug, editor]);

  const saveNow = React.useCallback(
    async (next: PageItem) => {
      if (!slug) return;
      setSaving(true);
      try {
        await api.put(`/pages/${slug}`, {
          title: next.title,
          blocks: editor.document,
          seo: next.seo,
        });
        setSavedAt(Date.now());
      } finally {
        setSaving(false);
      }
    },
    [slug, editor]
  );

  React.useEffect(() => {
    if (!page) return;
    const t = setTimeout(() => saveNow(page), 1500);
    return () => clearTimeout(t);
  }, [page, saveNow]);

  React.useEffect(() => {
    if (!page) return;
    const handler = () => {
      setPage((p) => (p ? { ...p } : p));
    };
    editor.onChange(handler);
  }, [editor, page]);

  if (!page) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/tea/admin/pages"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            ← Back to pages
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="font-semibold text-sm">{page.title || slug}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {saving ? "Saving…" : savedAt ? "Saved" : ""}
        </span>
      </div>

      <input
        type="text"
        value={page.title}
        onChange={(e) => setPage({ ...page, title: e.target.value })}
        placeholder="Page title"
        className="text-2xl font-semibold rounded-md bg-transparent px-0 py-1 focus:outline-none border-0"
      />

      <div className="rounded-md border border-border bg-background min-h-96">
        <BlockNoteView editor={editor} />
      </div>

      <details className="rounded-md border border-border bg-card">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold">
          SEO settings
        </summary>
        <div className="p-4 flex flex-col gap-3 border-t border-border">
          <input
            type="text"
            value={page.seo.title ?? ""}
            onChange={(e) =>
              setPage({ ...page, seo: { ...page.seo, title: e.target.value || null } })
            }
            placeholder="SEO title"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={page.seo.description ?? ""}
            onChange={(e) =>
              setPage({
                ...page,
                seo: { ...page.seo, description: e.target.value || null },
              })
            }
            placeholder="Meta description"
            rows={3}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <input
            type="text"
            value={page.seo.canonical ?? ""}
            onChange={(e) =>
              setPage({
                ...page,
                seo: { ...page.seo, canonical: e.target.value || null },
              })
            }
            placeholder="Canonical URL (optional)"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={page.seo.no_index}
              onChange={(e) =>
                setPage({ ...page, seo: { ...page.seo, no_index: e.target.checked } })
              }
            />
            Hide from search engines (noindex)
          </label>
        </div>
      </details>
    </div>
  );
}
