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
