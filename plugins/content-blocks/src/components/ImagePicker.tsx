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
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {value?.url ? (
          <img
            src={value.url}
            alt={value.alt}
            className="h-16 w-16 rounded border border-input object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded border border-dashed border-input flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">
            No image
          </div>
        )}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm px-3 py-1.5 rounded border border-input hover:bg-accent"
          >
            {value ? "Change" : "Select image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {value && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Alt text</label>
          <input
            type="text"
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="Describe the image"
            className="w-full rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
