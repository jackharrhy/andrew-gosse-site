// plugins/content-blocks/src/components/ColorPicker.tsx
import * as React from "react";

interface FieldWidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  id: string;
  required?: boolean;
}

const VALID_HEX = /^#[\da-f]{6}$/i;

export function ColorPicker({ value, onChange, label, id, required }: FieldWidgetProps) {
  const raw = typeof value === "string" && value ? value : "#ffffff";
  const safe = VALID_HEX.test(raw) ? raw : "#ffffff";

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium leading-none mb-1.5 block">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          id={id}
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border border-input p-0.5"
        />
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="flex h-10 w-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div
          className="h-10 flex-1 rounded-md border border-input"
          style={{ backgroundColor: safe }}
        />
      </div>
    </div>
  );
}
