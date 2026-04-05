// plugins/content-blocks/src/components/blocks/MediaBlock.tsx
import * as React from "react";
import { ImagePicker } from "../ImagePicker";
import { Repeater } from "../Repeater";
import type { MediaBlock as MediaBlockType, AdornmentBlock } from "@site/types/emdash";

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
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function MediaBlock({ block, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const update = (patch: Partial<MediaBlockType>) =>
    onChange({ ...block, ...patch });

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Media</span>
      </div>
      <div className="p-4 flex flex-col gap-4">
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
          className="self-start text-xs px-2 py-1 rounded border border-input hover:bg-accent flex items-center gap-1"
        >
          Advanced layout {showAdvanced ? "▴" : "▾"}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 pl-3 border-l border-border">
            {/* Dimensions & spacing */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Dimensions &amp; spacing</p>
              <div className="grid grid-cols-2 gap-2">
                <LayoutInput label="Width" value={block.width} placeholder="e.g. 400px" onChange={(v) => update({ width: v || undefined })} />
                <LayoutInput label="Height" value={block.height} placeholder="e.g. 30rem" onChange={(v) => update({ height: v || undefined })} />
                <LayoutInput label="Padding" value={block.padding} placeholder="e.g. 1rem" onChange={(v) => update({ padding: v || undefined })} />
                <LayoutInput label="Margin" value={block.margin} placeholder="e.g. 0 auto" onChange={(v) => update({ margin: v || undefined })} />
              </div>
            </div>

            {/* Position */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Position</p>
              <div className="grid grid-cols-2 gap-2">
                <LayoutInput label="Top" value={block.top} placeholder="e.g. 10px" onChange={(v) => update({ top: v || undefined })} />
                <LayoutInput label="Right" value={block.right} placeholder="e.g. 10px" onChange={(v) => update({ right: v || undefined })} />
                <LayoutInput label="Bottom" value={block.bottom} placeholder="e.g. 10px" onChange={(v) => update({ bottom: v || undefined })} />
                <LayoutInput label="Left" value={block.left} placeholder="e.g. 10px" onChange={(v) => update({ left: v || undefined })} />
              </div>
            </div>

            {/* Single-column extras */}
            <div className="flex flex-col gap-2">
              <LayoutInput
                label="Rotation (degrees)"
                value={block.rotation}
                type="number"
                placeholder="e.g. -2"
                onChange={(v) => update({ rotation: v ? Number(v) : undefined })}
              />
              <LayoutInput label="Border" value={block.border} placeholder="e.g. 2px solid black" onChange={(v) => update({ border: v || undefined })} />
              <LayoutInput label="Filter" value={block.filter} placeholder="e.g. grayscale(100%)" onChange={(v) => update({ filter: v || undefined })} />
            </div>

            {/* Adornments */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Adornments</p>
              <Repeater<AdornmentBlock>
                items={block.adornments ?? []}
                onChange={(adornments) => update({ adornments })}
                createItem={() => ({ file: { url: "", alt: null } })}
                addLabel="+ Add adornment"
                renderItem={(adornment, _i, updateAdornment) => (
                  <div className="flex flex-col gap-3 p-3 rounded border border-border bg-background">
                    <ImagePicker
                      label="Adornment image"
                      value={adornment.file?.url ? { url: adornment.file.url, alt: adornment.file.alt ?? "" } : null}
                      onChange={(val) =>
                        updateAdornment({
                          ...adornment,
                          file: val ? { url: val.url, alt: val.alt } : { url: "", alt: null },
                        })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {(["top", "right", "bottom", "left", "width", "height", "padding", "margin"] as const).map((field) => (
                        <LayoutInput
                          key={field}
                          label={field.charAt(0).toUpperCase() + field.slice(1)}
                          value={adornment[field]}
                          placeholder="e.g. 10px"
                          onChange={(v) => updateAdornment({ ...adornment, [field]: v || undefined })}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <LayoutInput
                        label="Rotation (degrees)"
                        value={adornment.rotation}
                        type="number"
                        placeholder="e.g. -25"
                        onChange={(v) => updateAdornment({ ...adornment, rotation: v ? Number(v) : undefined })}
                      />
                      <LayoutInput
                        label="Border"
                        value={adornment.border}
                        placeholder="e.g. 2px solid black"
                        onChange={(v) => updateAdornment({ ...adornment, border: v || undefined })}
                      />
                      <LayoutInput
                        label="Filter"
                        value={adornment.filter}
                        placeholder="e.g. hue-rotate(45deg)"
                        onChange={(v) => updateAdornment({ ...adornment, filter: v || undefined })}
                      />
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
