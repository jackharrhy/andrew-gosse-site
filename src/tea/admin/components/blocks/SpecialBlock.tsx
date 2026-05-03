// src/tea/admin/components/blocks/SpecialBlock.tsx
import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

export const specialBlock = createReactBlockSpec(
  {
    type: "special",
    propSchema: {
      type: { default: "riso_colors", values: ["riso_colors"] },
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: "none",
  },
  {
    render: (props) => (
      <div
        className="p-4 rounded border border-dashed border-border bg-muted/30 text-center"
        contentEditable={false}
      >
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Special Component
        </span>
        <p className="text-sm mt-1">{props.block.props.type}</p>
      </div>
    ),
  }
);
