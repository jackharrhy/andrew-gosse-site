// plugins/content-blocks/src/components/ImagePicker.tsx
import * as React from "react";
import { MediaPickerModal } from "@emdash-cms/admin";
import type { MediaItem } from "@emdash-cms/admin";

interface ImageValue {
  url: string;
  alt: string;
}

interface ImagePickerProps {
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  label: string;
}

export function ImagePicker({ value, onChange, label }: ImagePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (item: MediaItem) => {
    onChange({ url: item.url, alt: item.filename });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">{label}</span>

      {/* Preview */}
      <div className="relative">
        {value?.url ? (
          <img
            src={value.url}
            alt={value.alt}
            className="w-full max-h-48 rounded-md border border-input object-contain bg-muted/30"
          />
        ) : (
          <div
            onClick={() => setOpen(true)}
            className="w-full h-32 rounded-md border-2 border-dashed border-input flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-ring hover:bg-accent/50 transition-colors"
          >
            <span className="text-2xl">🖼</span>
            <span className="text-sm">Click to select an image</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
        >
          {value ? "Change image" : "Select image"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Alt text */}
      {value && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Alt text</label>
          <input
            type="text"
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="Describe the image for screen readers"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <MediaPickerModal
        open={open}
        onOpenChange={setOpen}
        onSelect={handleSelect}
        mimeTypeFilter="image/"
        title={label}
      />
    </div>
  );
}
