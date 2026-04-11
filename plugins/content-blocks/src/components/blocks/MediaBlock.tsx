// plugins/content-blocks/src/components/blocks/MediaBlock.tsx
import * as React from "react";
import { ImagePicker } from "../ImagePicker";
import { AdornmentPickerModal } from "../AdornmentPickerModal";
import type { MediaBlock as MediaBlockType, AdornmentValue, AdornmentRef } from "@site/types/emdash";

interface Props {
  block: MediaBlockType;
  onChange: (block: MediaBlockType) => void;
}

interface LayoutInputProps {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
}

function LayoutInput({ label, value, onChange, type = "text", placeholder }: LayoutInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</p>
  );
}

export function MediaBlock({ block, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const update = (patch: Partial<MediaBlockType>) =>
    onChange({ ...block, ...patch });

  const adornments: AdornmentValue[] = block.adornments ?? [];

  const addAdornment = (name: string) => {
    const ref: AdornmentRef = { _adornmentName: name };
    update({ adornments: [...adornments, ref] });
  };

  const removeAdornment = (index: number) => {
    update({ adornments: adornments.filter((_, i) => i !== index) });
  };

  const getAdornmentLabel = (a: AdornmentValue): string => {
    if ("_adornmentName" in a) return a._adornmentName;
    return "(legacy inline)";
  };

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media</span>
      </div>
      <div className="p-4 flex flex-col gap-5">
        {/* Always visible: image picker */}
        <ImagePicker
          label="Image"
          value={block.file?.url ? { url: block.file.url, alt: block.file.alt ?? "" } : null}
          onChange={(val) =>
            update({ file: val ? { url: val.url, alt: val.alt } : { url: "", alt: null } })
          }
        />

        {/* Advanced layout toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="self-start text-sm px-4 py-1.5 rounded-md border border-input hover:bg-accent font-medium flex items-center gap-2 transition-colors"
        >
          <span>Layout &amp; positioning</span>
          <span className="text-muted-foreground">{showAdvanced ? "▴" : "▾"}</span>
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-6 pl-4 border-l-2 border-border">
            {/* Dimensions & spacing */}
            <div>
              <SectionLabel>Dimensions &amp; spacing</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <LayoutInput label="Width" value={block.width} placeholder="e.g. 400px or 80%" onChange={(v) => update({ width: v || undefined })} />
                <LayoutInput label="Max height" value={block.height} placeholder="e.g. 30rem" onChange={(v) => update({ height: v || undefined })} />
                <LayoutInput label="Padding" value={block.padding} placeholder="e.g. 1rem" onChange={(v) => update({ padding: v || undefined })} />
                <LayoutInput label="Margin" value={block.margin} placeholder="e.g. 0 auto" onChange={(v) => update({ margin: v || undefined })} />
              </div>
            </div>

            {/* Position */}
            <div>
              <SectionLabel>Position offset</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <LayoutInput label="Top" value={block.top} placeholder="e.g. 10px" onChange={(v) => update({ top: v || undefined })} />
                <LayoutInput label="Right" value={block.right} placeholder="e.g. 10px" onChange={(v) => update({ right: v || undefined })} />
                <LayoutInput label="Bottom" value={block.bottom} placeholder="e.g. 10px" onChange={(v) => update({ bottom: v || undefined })} />
                <LayoutInput label="Left" value={block.left} placeholder="e.g. 10px" onChange={(v) => update({ left: v || undefined })} />
              </div>
            </div>

            {/* Style */}
            <div>
              <SectionLabel>Style</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <LayoutInput
                  label="Rotation (degrees)"
                  value={block.rotation}
                  type="number"
                  placeholder="e.g. -2"
                  onChange={(v) => update({ rotation: v ? Number(v) : undefined })}
                />
                <LayoutInput label="Border" value={block.border} placeholder="e.g. 2px solid black" onChange={(v) => update({ border: v || undefined })} />
                <div className="col-span-2">
                  <LayoutInput label="CSS Filter" value={block.filter} placeholder="e.g. grayscale(100%)" onChange={(v) => update({ filter: v || undefined })} />
                </div>
              </div>
            </div>

            {/* Adornments — named library references */}
            <div>
              <SectionLabel>Adornments</SectionLabel>
              <p className="text-xs text-muted-foreground mb-3">
                Decorative images layered on top (tape, lines, etc.). Pick from the{" "}
                <a
                  href="/_emdash/admin/plugins/content-blocks/adornment-library"
                  className="underline hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Adornment Library
                </a>.
              </p>

              {/* Current adornments as chips */}
              {adornments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {adornments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-sm"
                    >
                      <span className="text-foreground">{getAdornmentLabel(a)}</span>
                      <button
                        type="button"
                        onClick={() => removeAdornment(i)}
                        className="text-muted-foreground hover:text-destructive leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-sm px-3 py-1.5 rounded-md border border-input hover:bg-accent transition-colors"
              >
                + Add adornment
              </button>

              <AdornmentPickerModal
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={addAdornment}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
