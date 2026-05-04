// src/tea/admin/components/shared/ColorPicker.tsx
import * as React from "react";

const VALID_HEX = /^#[\da-f]{6}$/i;

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function ColorPicker({ value, onChange, label }: Props) {
  const safe = VALID_HEX.test(value) ? value : "#ffffff";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded border border-input p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="flex h-10 w-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div
          className="h-10 flex-1 rounded-md border border-input"
          style={{ backgroundColor: safe }}
        />
      </div>
    </div>
  );
}
