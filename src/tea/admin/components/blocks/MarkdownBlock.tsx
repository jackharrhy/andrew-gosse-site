// src/tea/admin/components/blocks/MarkdownBlock.tsx
// Escape-hatch block for raw markdown + HTML. Used during migration for content
// that has embedded `<span style>` or other HTML that doesn't fit native blocks.
// Authors should rarely need to add new ones — prefer native blocks.
import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

interface MarkdownBlockEditorProps {
  block: { props: Record<string, string> };
  editor: {
    updateBlock: (block: unknown, update: unknown) => void;
  };
}

function MarkdownBlockEditor({ block, editor }: MarkdownBlockEditorProps) {
  const body = block.props.body || "";

  return (
    <div
      className="rounded-md border border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden my-2"
      contentEditable={false}
    >
      <div className="px-3 py-2 border-b border-amber-400/40 bg-amber-100/60 dark:bg-amber-900/30 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Markdown / HTML
        </span>
        <span className="text-[10px] text-amber-700/70 dark:text-amber-300/70">
          escape hatch — supports markdown and raw HTML
        </span>
      </div>
      <textarea
        value={body}
        rows={Math.min(Math.max(body.split("\n").length, 4), 20)}
        onChange={(e) =>
          editor.updateBlock(block, {
            type: "markdown",
            props: { ...block.props, body: e.target.value },
          })
        }
        className="w-full p-3 bg-transparent text-sm font-mono focus:outline-none resize-y"
        placeholder="Markdown body… raw HTML allowed."
      />
    </div>
  );
}

export const markdownBlock = createReactBlockSpec(
  {
    type: "markdown",
    propSchema: {
      body: { default: "" },
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: "none",
  },
  {
    render: (props) => (
      <MarkdownBlockEditor {...(props as unknown as MarkdownBlockEditorProps)} />
    ),
  }
);
