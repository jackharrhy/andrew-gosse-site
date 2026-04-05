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
          <div className="p-3 rounded border border-border text-xs text-muted-foreground">
            Unknown block type: {(block as { _type: string })._type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <div key={index} className="flex gap-2 items-start">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-1 pt-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === blocks.length - 1}
              className="text-xs px-1 py-0.5 rounded border border-input hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              ↓
            </button>
          </div>
          {/* Block editor */}
          <div className="flex-1 min-w-0">{renderBlock(block, index)}</div>
          {/* Remove button */}
          <button
            type="button"
            onClick={() => remove(index)}
            className="mt-2 flex-shrink-0 text-sm px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
            title="Remove block"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add block menu */}
      <div className="relative self-start" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="text-sm px-3 py-1.5 rounded border border-input hover:bg-accent flex items-center gap-1"
        >
          + Add block {menuOpen ? "▴" : "▾"}
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-background border border-border rounded shadow-md min-w-40 flex flex-col">
            <button
              type="button"
              onClick={() => addBlock("richText")}
              className="px-4 py-2 text-sm text-left hover:bg-accent"
            >
              Rich Text
            </button>
            <button
              type="button"
              onClick={() => addBlock("media")}
              className="px-4 py-2 text-sm text-left hover:bg-accent"
            >
              Media
            </button>
            <button
              type="button"
              onClick={() => addBlock("specialComponent")}
              className="px-4 py-2 text-sm text-left hover:bg-accent"
            >
              Special Component
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
