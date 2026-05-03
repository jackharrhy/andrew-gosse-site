// src/tea/admin/components/blocks/schema.ts
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { mediaBlock } from "./MediaBlock";
import { specialBlock } from "./SpecialBlock";

// `createReactBlockSpec` returns a factory `(options?) => BlockSpec`.
// Call each factory to produce the actual BlockSpec that BlockNoteSchema expects.
export const teaBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    media: mediaBlock(),
    special: specialBlock(),
  },
});

export type TeaBlock =
  (typeof teaBlockSchema)["BlockNoteEditor"]["topLevelBlocks"][number];
