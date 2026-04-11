// plugins/content-blocks/src/components/AdornmentPickerModal.tsx
import * as React from "react";
import { fetchContentList } from "@emdash-cms/admin";

interface AdornmentItem {
  id: string;
  slug: string | null;
  data: {
    name: string;
    file?: { url: string; alt: string } | null;
    height?: string | null;
    width?: string | null;
    rotation?: number | null;
    filter?: string | null;
    top?: string | null;
    right?: string | null;
    bottom?: string | null;
    left?: string | null;
    padding?: string | null;
    margin?: string | null;
  };
}

interface AdornmentPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string) => void;
}

export function AdornmentPickerModal({ open, onOpenChange, onSelect }: AdornmentPickerModalProps) {
  const [adornments, setAdornments] = React.useState<AdornmentItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchContentList("adornments", { limit: 100 })
      .then((result) => setAdornments(result.items as AdornmentItem[]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-card rounded-lg border border-border shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Pick an adornment</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading && (
            <div className="text-muted-foreground text-sm">Loading adornments…</div>
          )}
          {!loading && adornments.length === 0 && (
            <div className="text-muted-foreground text-sm">
              No adornments in the library yet.{" "}
              <a
                href="/_emdash/admin/plugins/content-blocks/adornment-library"
                className="underline hover:text-foreground"
              >
                Add some first.
              </a>
            </div>
          )}
          {!loading && adornments.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {adornments.map((a) => {
                const d = a.data;
                const rot = typeof d.rotation === "number" ? d.rotation : 0;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { onSelect(d.name); onOpenChange(false); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-md border border-border hover:border-ring hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="h-16 flex items-center justify-center overflow-hidden">
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
                        <div className="w-12 h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-center text-muted-foreground leading-tight">
                      {d.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
