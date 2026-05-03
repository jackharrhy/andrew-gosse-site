// src/tea/admin/components/HomepageEditor.tsx
import * as React from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { api } from "../lib/api";
import { teaBlockSchema } from "./blocks/schema";

export function HomepageEditor() {
  const [loaded, setLoaded] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const editor = useCreateBlockNote({
    schema: teaBlockSchema,
  });

  React.useEffect(() => {
    api
      .get<{ item: { blocks: unknown[] } }>("/homepage")
      .then((r) => {
        if (r.item.blocks && r.item.blocks.length > 0) {
          editor.replaceBlocks(
            editor.document,
            r.item.blocks as Parameters<typeof editor.replaceBlocks>[1]
          );
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [editor]);

  React.useEffect(() => {
    if (!loaded) return;
    let t: number;
    const handler = () => {
      window.clearTimeout(t);
      t = window.setTimeout(async () => {
        setSaving(true);
        try {
          await api.put("/homepage", { blocks: editor.document });
          setSavedAt(Date.now());
        } finally {
          setSaving(false);
        }
      }, 1500);
    };
    editor.onChange(handler);
  }, [editor, loaded]);

  if (!loaded) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Homepage</h1>
        <span className="text-xs text-muted-foreground">
          {saving ? "Saving…" : savedAt ? "Saved" : ""}
        </span>
      </div>
      <div className="rounded-md border border-border bg-background min-h-96">
        <BlockNoteView editor={editor} />
      </div>
    </div>
  );
}
