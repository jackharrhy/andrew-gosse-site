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
      className={`flex items-center gap-4 px-6 py-3 ${
        sticky
          ? "sticky top-0 z-10 bg-card border-b border-border shadow-sm"
          : "border-t border-border mt-6 pt-4"
      }`}
    >
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {saving ? "Saving…" : "Save & Publish"}
      </button>
      {saveStatus === "saved" && (
        <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
          ✓ Saved
        </span>
      )}
      {saveStatus === "error" && (
        <span className="text-sm text-destructive font-medium">Save failed — try again</span>
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
      fetchContentList("pages", { limit: 100 }),
      fetchContentList("homepage", { limit: 1 }),
    ])
      .then(([pagesResult, homepageResult]) => {
        setPages(pagesResult.items as PageListItem[]);
        setHomepage((homepageResult.items[0] as PageListItem) ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading pages…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Page Editor</h1>
        <p className="text-sm text-muted-foreground">
          Select a page to edit its content blocks. To change the title, slug, or SEO settings, use the standard content editor.
        </p>
      </div>

      {homepage && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Homepage</h2>
          <a
            href={`/_emdash/admin/plugins/content-blocks/page-editor?id=${homepage.id}&collection=homepage`}
            className="px-4 py-3 rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 text-sm font-medium transition-colors flex items-center justify-between group"
          >
            <span>Homepage</span>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
          </a>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Pages</h2>
        {pages.length === 0 && (
          <p className="text-sm text-muted-foreground">No pages found.</p>
        )}
        {pages.map((page) => (
          <a
            key={page.id}
            href={`/_emdash/admin/plugins/content-blocks/page-editor?id=${page.id}&collection=pages`}
            className="px-4 py-3 rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 text-sm font-medium transition-colors flex items-center justify-between group"
          >
            <span>{(page.data?.page_slug as string) || page.slug || page.id}</span>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
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
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (errorMsg && blocks.length === 0) {
    return (
      <div className="p-8 text-destructive">Failed to load page: {errorMsg}</div>
    );
  }

  return (
    <div className="flex flex-col">
      <SaveBar
        sticky
        saving={saving}
        saveStatus={saveStatus}
        onSave={handleSave}
        disabled={saving}
      />

      <div className="max-w-3xl mx-auto w-full px-6 py-4 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-sm">
          <a href={backHref} className="text-muted-foreground hover:text-foreground transition-colors">
            ← {title}
          </a>
          <span className="text-border">/</span>
          <span className="font-semibold text-foreground">Blocks</span>
        </div>

        <BlockList blocks={blocks} onChange={setBlocks} />

        {saveStatus === "error" && errorMsg && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
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
    </div>
  );
}
