// src/types/blocks.ts
// Block types stored in pages.blocks and homepage.blocks.
// These mirror BlockNote's JSON shape, with custom block types added.

export interface InlineText {
  type: "text";
  text: string;
  styles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    textColor?: string;
    backgroundColor?: string;
  };
}

export interface InlineLink {
  type: "link";
  href: string;
  content: InlineText[];
}

export type InlineContent = InlineText | InlineLink;

// BlockNote-native block types (subset we use)
export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  props: { textAlignment?: "left" | "center" | "right" | "justify" };
  content: InlineContent[];
  children: Block[];
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  props: { level: 1 | 2 | 3; textAlignment?: "left" | "center" | "right" | "justify" };
  content: InlineContent[];
  children: Block[];
}

export interface BulletListItemBlock {
  id: string;
  type: "bulletListItem";
  props: { textAlignment?: "left" | "center" | "right" | "justify" };
  content: InlineContent[];
  children: Block[];
}

export interface NumberedListItemBlock {
  id: string;
  type: "numberedListItem";
  props: { textAlignment?: "left" | "center" | "right" | "justify" };
  content: InlineContent[];
  children: Block[];
}

export interface QuoteBlock {
  id: string;
  type: "quote";
  props: object;
  content: InlineContent[];
  children: Block[];
}

// Custom: media block with CSS layout + adornment refs
export interface MediaBlock {
  id: string;
  type: "media";
  props: {
    mediaId: string;
    alt: string;
    width: string;
    height: string;
    padding: string;
    margin: string;
    top: string;
    right: string;
    bottom: string;
    left: string;
    rotation: string; // degrees as string e.g. "-2"
    border: string;
    filter: string;
    adornments: string; // JSON: Array<{ adornmentName: string }>
  };
  content: [];
  children: Block[];
}

// Custom: special component block
export interface SpecialBlock {
  id: string;
  type: "special";
  props: { type: "riso_colors" };
  content: [];
  children: Block[];
}

// Custom: markdown escape hatch — body is markdown + raw HTML, rendered via marked
export interface MarkdownBlock {
  id: string;
  type: "markdown";
  props: { body: string };
  content: [];
  children: Block[];
}

// Custom: horizontal rule
export interface DividerBlock {
  id: string;
  type: "divider";
  props: object;
  content: [];
  children: Block[];
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | BulletListItemBlock
  | NumberedListItemBlock
  | QuoteBlock
  | MediaBlock
  | SpecialBlock
  | MarkdownBlock
  | DividerBlock;

// Reference to a named adornment (parsed from MediaBlock.props.adornments JSON)
export interface AdornmentRef {
  adornmentName: string;
}

// Resolved adornment from the library (returned by fetchAdornmentLibrary)
export interface ResolvedAdornment {
  name: string;
  url: string;
  alt: string | null;
  css: {
    width?: string;
    height?: string;
    padding?: string;
    margin?: string;
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
    rotation?: number;
    border?: string;
    filter?: string;
  };
}

// Sidebar shapes (stored as JSON in sidebar.categories and sidebar.links)
export interface SidebarItem {
  text: string;
  pageSlug: string;
}

export interface SidebarCategory {
  categoryTitle: string;
  backgroundImageId?: string | null;
  items: SidebarItem[];
}

export interface SidebarLink {
  service: string;
  url: string;
}
