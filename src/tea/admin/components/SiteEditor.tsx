// src/tea/admin/components/SiteEditor.tsx
import * as React from "react";
import { api } from "../lib/api";
import { ColorPicker } from "./shared/ColorPicker";

interface Site {
  background_color: string;
}

export function SiteEditor() {
  const [site, setSite] = React.useState<Site | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    api.get<{ item: Site }>("/site").then((r) => setSite(r.item));
  }, []);

  React.useEffect(() => {
    if (!site) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put("/site", site);
        setSavedAt(Date.now());
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [site]);

  if (!site) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Site</h1>
        <span className="text-xs text-muted-foreground">
          {saving ? "Saving…" : savedAt ? "Saved" : ""}
        </span>
      </div>
      <ColorPicker
        label="Background color"
        value={site.background_color}
        onChange={(v) => setSite({ ...site, background_color: v })}
      />
    </div>
  );
}
