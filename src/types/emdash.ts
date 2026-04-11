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

// Reference to a named adornment in the library
export interface AdornmentRef {
  _adornmentName: string;
}

// Union: either a library reference or a legacy inline value
export type AdornmentValue = AdornmentBlock | AdornmentRef;

// Type guard
export function isAdornmentRef(a: AdornmentValue): a is AdornmentRef {
  return "_adornmentName" in a;
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
  adornments?: AdornmentValue[];
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
