// plugins/content-blocks/src/admin.tsx
import { SidebarEditor } from "./components/SidebarEditor";
import { PageEditor } from "./components/PageEditor";
import { SeoAudit } from "./components/SeoAudit";
import { ColorPicker } from "./components/ColorPicker";
import { SidebarFieldRedirect } from "./components/SidebarFieldRedirect";
import { BlocksFieldRedirect } from "./components/BlocksFieldRedirect";

// Pages keyed by path — must match adminPages paths in index.ts
export const pages = {
  "/sidebar": SidebarEditor,
  "/page-editor": PageEditor,
  "/seo-audit": SeoAudit,
};

// Field widgets keyed by name — must match fieldWidgets names in index.ts
export const fields = {
  colorPicker: ColorPicker,
  sidebarField: SidebarFieldRedirect,
  blocksField: BlocksFieldRedirect,
};
