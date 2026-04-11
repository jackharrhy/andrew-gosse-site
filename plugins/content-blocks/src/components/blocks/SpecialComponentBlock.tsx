// plugins/content-blocks/src/components/blocks/SpecialComponentBlock.tsx
import * as React from "react";
import type { SpecialComponentBlock as SpecialComponentBlockType } from "@site/types/emdash";

interface Props {
  block: SpecialComponentBlockType;
  onChange: (block: SpecialComponentBlockType) => void;
}

export function SpecialComponentBlock({ block, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded border border-border bg-card">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Special Component</span>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Component type</label>
        <select
          value={block.type}
          onChange={(e) => onChange({ ...block, type: e.target.value as "riso_colors" })}
          className="rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="riso_colors">Riso Colors</option>
        </select>
      </div>
    </div>
  );
}
