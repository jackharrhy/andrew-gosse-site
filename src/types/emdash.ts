// astro-site/src/types/emdash.ts

export interface MediaFile {
  url: string;
  alt: string | null;
}

export interface AdornmentBlock {
  file: MediaFile;
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
}

export interface MediaBlock {
  _type: "media";
  file: MediaFile;
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
  adornments?: AdornmentBlock[];
}

export interface RichTextBlock {
  _type: "richText";
  body: string;
}

export interface SpecialComponentBlock {
  _type: "specialComponent";
  type: "riso_colors";
}

export type Block = MediaBlock | RichTextBlock | SpecialComponentBlock;

export interface Seo {
  metaTitle?: string | null;
  metaDescription?: string | null;
  shareImage?: MediaFile | null;
}

export interface SidebarItem {
  text: string;
  page: { slug: string };
}

export interface SidebarCategory {
  categoryTitle: string;
  backgroundImage?: MediaFile | null;
  items: SidebarItem[];
}

export interface SidebarLink {
  service: string;
  url: string;
}
