// src/tea/admin/components/shared/ImagePicker.tsx
import * as React from "react";
import { MediaBrowser } from "../MediaBrowser";

interface ImageValue {
  mediaId: string;
  url: string;
  alt: string;
}

interface Props {
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  label: string;
}

export function ImagePicker({ value, onChange, label }: Props) {
  const [picking, setPicking] = React.useState(false);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{label}</span>

      {picking ? (
        <div className="rounded-md border border-border bg-card p-4">
          <MediaBrowser
            mode="picker"
            onSelect={(item) => {
              onChange({
                mediaId: item.id,
                url: item.url,
                alt: item.alt ?? "",
              });
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        </div>
      ) : (
        <>
          <div className="relative">
            {value?.url ? (
              <img
                src={value.url}
                alt={value.alt}
                className="w-full max-h-48 rounded-md border border-input object-contain bg-muted/30"
              />
            ) : (
              <div
                onClick={() => setPicking(true)}
                className="w-full h-32 rounded-md border-2 border-dashed border-input flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-ring hover:bg-accent/50 transition-colors"
              >
                <span className="text-2xl">🖼</span>
                <span className="text-sm">Click to select an image</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent"
            >
              {value ? "Change image" : "Select image"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5"
              >
                Remove
              </button>
            )}
          </div>
          {value && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Alt text</label>
              <input
                type="text"
                value={value.alt}
                onChange={(e) => onChange({ ...value, alt: e.target.value })}
                placeholder="Describe the image"
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
