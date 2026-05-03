// src/tea/admin/components/blocks/schema.ts
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { mediaBlock } from "./MediaBlock";
import { specialBlock } from "./SpecialBlock";

export const teaBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    media: mediaBlock,
    special: specialBlock,
  },
});

export type TeaBlock =
  (typeof teaBlockSchema)["BlockNoteEditor"]["topLevelBlocks"][number];
