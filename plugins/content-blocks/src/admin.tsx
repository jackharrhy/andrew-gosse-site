// plugins/content-blocks/src/admin.tsx
import { SidebarEditor } from "./components/SidebarEditor";
import { ColorPicker } from "./components/ColorPicker";

// Pages keyed by path — must match adminPages paths in index.ts
export const pages = {
  "/sidebar": SidebarEditor,
};

// Field widgets keyed by name — must match fieldWidgets names in index.ts
export const fields = {
  colorPicker: ColorPicker,
};
