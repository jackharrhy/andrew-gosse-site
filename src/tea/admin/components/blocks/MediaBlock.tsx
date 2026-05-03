// src/tea/admin/components/blocks/MediaBlock.tsx
import * as React from "react";
import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { api } from "../../lib/api";
import { ImagePicker } from "../shared/ImagePicker";

interface MediaItem {
  id: string;
  url: string;
  alt: string | null;
}

interface AdornmentItem {
  id: string;
  name: string;
}

const LAYOUT_KEYS = [
  "width",
  "height",
  "padding",
  "margin",
  "top",
  "right",
  "bottom",
  "left",
  "rotation",
  "border",
  "filter",
] as const;

export const mediaBlock = createReactBlockSpec(
  {
    type: "media",
    propSchema: {
      mediaId: { default: "" },
      alt: { default: "" },
      width: { default: "" },
      height: { default: "" },
      padding: { default: "" },
      margin: { default: "" },
      top: { default: "" },
      right: { default: "" },
      bottom: { default: "" },
      left: { default: "" },
      rotation: { default: "" },
      border: { default: "" },
      filter: { default: "" },
      adornments: { default: "[]" },
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: "none",
  },
  {
    // BlockNote types are heavy; cast through unknown to keep this file
    // self-contained without pulling in the full editor type tree.
    render: (props) => <MediaBlockEditor {...(props as unknown as MediaBlockEditorProps)} />,
  }
);

interface MediaBlockEditorProps {
  block: { props: Record<string, string> };
  editor: {
    updateBlock: (block: unknown, update: unknown) => void;
  };
}

function MediaBlockEditor({ block, editor }: MediaBlockEditorProps) {
  const [showLayout, setShowLayout] = React.useState(false);
  const [showAdornments, setShowAdornments] = React.useState(false);
  const [media, setMedia] = React.useState<MediaItem | null>(null);
  const [allAdornments, setAllAdornments] = React.useState<AdornmentItem[]>([]);

  React.useEffect(() => {
    if (!block.props.mediaId) {
      setMedia(null);
      return;
    }
    api
      .get<{ items: MediaItem[] }>("/media")
      .then((r) => {
        const m = r.items.find((i) => i.id === block.props.mediaId);
        setMedia(m ?? null);
      })
      .catch(() => setMedia(null));
  }, [block.props.mediaId]);

  React.useEffect(() => {
    api
      .get<{ items: AdornmentItem[] }>("/adornments")
      .then((r) => setAllAdornments(r.items))
      .catch(() => undefined);
  }, []);

  const update = (patch: Record<string, string>) => {
    editor.updateBlock(block, {
      type: "media",
      props: { ...block.props, ...patch },
    });
  };

  const adornmentRefs: { adornmentName: string }[] = (() => {
    try {
      const parsed = JSON.parse(block.props.adornments || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const setAdornments = (refs: { adornmentName: string }[]) => {
    update({ adornments: JSON.stringify(refs) });
  };

  return (
    <div
      className="rounded-md border border-border bg-card overflow-hidden my-2"
      contentEditable={false}
    >
      <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Media
        </span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <ImagePicker
          label="Image"
          value={
            media
              ? { mediaId: media.id, url: media.url, alt: block.props.alt }
              : null
          }
          onChange={(v) => {
            update({
              mediaId: v?.mediaId ?? "",
              alt: v?.alt ?? "",
            });
          }}
        />

        <button
          type="button"
          onClick={() => setShowLayout((v) => !v)}
          className="self-start text-xs px-3 py-1.5 rounded-md border border-input hover:bg-accent"
        >
          Layout & positioning {showLayout ? "▴" : "▾"}
        </button>

        {showLayout && (
          <div className="grid grid-cols-2 gap-2">
            {LAYOUT_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{key}</label>
                <input
                  type="text"
                  value={block.props[key] ?? ""}
                  onChange={(e) => update({ [key]: e.target.value })}
                  placeholder={key === "rotation" ? "-25" : "e.g. 2rem"}
                  className="rounded-md border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdornments((v) => !v)}
          className="self-start text-xs px-3 py-1.5 rounded-md border border-input hover:bg-accent"
        >
          Adornments ({adornmentRefs.length}) {showAdornments ? "▴" : "▾"}
        </button>

        {showAdornments && (
          <div className="flex flex-col gap-2">
            {adornmentRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {adornmentRefs.map((ref, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded-full bg-muted border border-border text-xs flex items-center gap-1.5"
                  >
                    <span>{ref.adornmentName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAdornments(adornmentRefs.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setAdornments([
                    ...adornmentRefs,
                    { adornmentName: e.target.value },
                  ]);
                  e.target.value = "";
                }
              }}
              className="self-start rounded-md border border-input bg-transparent px-3 py-1 text-xs"
            >
              <option value="">+ Add adornment…</option>
              {allAdornments.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
