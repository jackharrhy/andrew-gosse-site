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
    <div className="rounded-md border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-muted/40 grid grid-cols-2 divide-x divide-border">
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Markdown</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</span>
        </div>
      </div>
      {/* Editor + Preview */}
      <div className="grid grid-cols-2 divide-x divide-border" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={block.body ?? ""}
            onChange={handleChange}
            placeholder={"# Heading\n\nParagraph text..."}
            className="w-full resize-none bg-transparent text-sm font-mono focus:outline-none leading-relaxed min-h-32"
            style={{ height: "auto" }}
          />
        </div>
        <div
          className="p-4 prose prose-sm max-w-none text-sm overflow-auto min-h-32"
          dangerouslySetInnerHTML={preview}
        />
      </div>
    </div>
  );
}
