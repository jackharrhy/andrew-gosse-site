// plugins/content-blocks/src/admin.tsx
import { SidebarEditor } from "./components/SidebarEditor";
import { PageEditor } from "./components/PageEditor";
import { SeoAudit } from "./components/SeoAudit";
import { AdornmentLibrary } from "./components/AdornmentLibrary";
import { ColorPicker } from "./components/ColorPicker";
import { SidebarFieldRedirect } from "./components/SidebarFieldRedirect";
import { BlocksFieldRedirect } from "./components/BlocksFieldRedirect";

export const pages = {
  "/sidebar": SidebarEditor,
  "/page-editor": PageEditor,
  "/seo-audit": SeoAudit,
  "/adornment-library": AdornmentLibrary,
};

export const fields = {
  colorPicker: ColorPicker,
  sidebarField: SidebarFieldRedirect,
  blocksField: BlocksFieldRedirect,
};
