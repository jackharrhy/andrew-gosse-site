// plugins/content-blocks/src/components/blocks/RichTextBlock.tsx
import * as React from "react";
import { marked } from "marked";
import type { RichTextBlock as RichTextBlockType } from "@site/types/emdash";

interface Props {
  block: RichTextBlockType;
  onChange: (block: RichTextBlockType) => void;
}

export function RichTextBlock({ block, onChange }: Props) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.body]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, body: e.target.value });
  };

  const preview = React.useMemo(
    () => ({ __html: marked.parse(block.body ?? "") as string }),
    [block.body]
  );

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rich Text</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border min-h-32" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Left: markdown editor */}
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={block.body ?? ""}
            onChange={handleChange}
            placeholder="# Heading&#10;&#10;Paragraph text..."
            className="w-full resize-none bg-transparent text-sm font-mono focus:outline-none min-h-32 leading-relaxed"
            style={{ height: "auto" }}
          />
        </div>
        {/* Right: live preview */}
        <div
          className="p-3 prose prose-sm max-w-none text-sm overflow-auto"
          dangerouslySetInnerHTML={preview}
        />
      </div>
    </div>
  );
}
