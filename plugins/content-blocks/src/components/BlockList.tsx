// plugins/content-blocks/src/components/BlockList.tsx
import * as React from "react";
import type { Block, MediaBlock, RichTextBlock, SpecialComponentBlock } from "@site/types/emdash";
import { RichTextBlock as RichTextBlockEditor } from "./blocks/RichTextBlock";
import { MediaBlock as MediaBlockEditor } from "./blocks/MediaBlock";
import { SpecialComponentBlock as SpecialComponentBlockEditor } from "./blocks/SpecialComponentBlock";

interface BlockListProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export function BlockList({ blocks, onChange }: BlockListProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...blocks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const next = [...blocks];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const update = (index: number) => (block: Block) => {
    const next = [...blocks];
    next[index] = block;
    onChange(next);
  };

  const addBlock = (type: Block["_type"]) => {
    setMenuOpen(false);
    const newBlock: Block =
      type === "richText"
        ? { _type: "richText", body: "" }
        : type === "media"
        ? { _type: "media", file: { url: "", alt: null } }
        : { _type: "specialComponent", type: "riso_colors" };
    onChange([...blocks, newBlock]);
  };

  const renderBlock = (block: Block, index: number) => {
    switch (block._type) {
      case "richText":
        return (
          <RichTextBlockEditor
            block={block as RichTextBlock}
            onChange={update(index) as (b: RichTextBlock) => void}
          />
        );
      case "media":
        return (
          <MediaBlockEditor
            block={block as MediaBlock}
            onChange={update(index) as (b: MediaBlock) => void}
          />
        );
      case "specialComponent":
        return (
          <SpecialComponentBlockEditor
            block={block as SpecialComponentBlock}
            onChange={update(index) as (b: SpecialComponentBlock) => void}
          />
        );
      default:
        return (
          <div className="p-4 rounded-md border border-border text-sm text-muted-foreground">
            Unknown block type: {(block as { _type: string })._type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => (
        <div key={index} className="flex gap-3 items-start group">
          {/* Reorder controls — stacked vertically, appear on hover */}
          <div className="flex flex-col gap-1 pt-3 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="w-7 h-7 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm transition-colors"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === blocks.length - 1}
              className="w-7 h-7 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm transition-colors"
              title="Move down"
            >
              ↓
            </button>
          </div>

          {/* Block editor */}
          <div className="flex-1 min-w-0">{renderBlock(block, index)}</div>

          {/* Remove button — subtle, right-aligned, red on hover */}
          <button
            type="button"
            onClick={() => remove(index)}
            className="mt-3 flex-shrink-0 w-7 h-7 rounded border border-input text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 flex items-center justify-center text-sm opacity-40 group-hover:opacity-100 transition-all"
            title="Remove block"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add block */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full py-3 rounded-md border-2 border-dashed border-border hover:border-ring hover:bg-accent/50 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span>Add block</span>
        </button>
        {menuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-lg overflow-hidden">
            {[
              { type: "richText" as const, label: "Rich Text", desc: "Markdown with live preview" },
              { type: "media" as const, label: "Media", desc: "Image with layout controls" },
              { type: "specialComponent" as const, label: "Special Component", desc: "Built-in site components" },
            ].map(({ type, label, desc }) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="w-full px-4 py-3 text-left hover:bg-accent flex flex-col gap-0.5 transition-colors"
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
