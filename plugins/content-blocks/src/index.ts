import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

export function contentBlocksPlugin(): PluginDescriptor {
  return {
    id: "content-blocks",
    version: "0.1.0",
    entrypoint: "@andrew-gosse-site/plugin-content-blocks",
    componentsEntry: "@andrew-gosse-site/plugin-content-blocks/astro",
    adminEntry: "@andrew-gosse-site/plugin-content-blocks/admin",
    adminPages: [
      { path: "/sidebar", label: "Sidebar", icon: "link" },
      { path: "/page-editor", label: "Page Editor", icon: "link" },
      { path: "/seo-audit", label: "SEO Audit", icon: "link" },
    ],
    options: {},
  };
}

export function createPlugin(): ResolvedPlugin {
  return definePlugin({
    id: "content-blocks",
    version: "0.1.0",
    capabilities: [],

    admin: {
      entry: "@andrew-gosse-site/plugin-content-blocks/admin",
      pages: [
        { path: "/sidebar", label: "Sidebar", icon: "link" },
        { path: "/page-editor", label: "Page Editor", icon: "link" },
        { path: "/seo-audit", label: "SEO Audit", icon: "link" },
      ],
      fieldWidgets: [
        { name: "colorPicker", label: "Color Picker", fieldTypes: ["string"] },
        { name: "sidebarField", label: "Sidebar Field", fieldTypes: ["json"] },
        { name: "blocksField", label: "Blocks Field", fieldTypes: ["portableText"] },
      ],
      portableTextBlocks: [
        {
          type: "richText",
          label: "Rich Text",
          icon: "code",
          description: "Markdown content block",
          fields: [
            {
              type: "text_input",
              action_id: "body",
              label: "Markdown body",
              placeholder: "# Heading\n\nParagraph text...",
              multiline: true,
            },
          ],
        },
        {
          type: "media",
          label: "Media",
          icon: "link",
          description: "Image with optional CSS layout and adornments",
          fields: [
            {
              type: "text_input",
              action_id: "file_url",
              label: "Image URL",
              placeholder: "/_emdash/api/media/file/...",
            },
            {
              type: "text_input",
              action_id: "file_alt",
              label: "Alt text",
              placeholder: "Describe the image",
            },
            {
              type: "text_input",
              action_id: "width",
              label: "Width",
              placeholder: "e.g. 400px or 50%",
            },
            {
              type: "text_input",
              action_id: "height",
              label: "Max height",
              placeholder: "e.g. 300px",
            },
            {
              type: "text_input",
              action_id: "padding",
              label: "Padding",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "margin",
              label: "Margin",
              placeholder: "e.g. 0 auto",
            },
            {
              type: "text_input",
              action_id: "top",
              label: "Top",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "right",
              label: "Right",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "bottom",
              label: "Bottom",
              placeholder: "e.g. 10px",
            },
            {
              type: "text_input",
              action_id: "left",
              label: "Left",
              placeholder: "e.g. 10px",
            },
            {
              type: "number_input",
              action_id: "rotation",
              label: "Rotation (degrees)",
            },
            {
              type: "text_input",
              action_id: "border",
              label: "Border",
              placeholder: "e.g. 2px solid black",
            },
            {
              type: "text_input",
              action_id: "filter",
              label: "CSS filter",
              placeholder: "e.g. grayscale(100%)",
            },
            {
              type: "text_input",
              action_id: "adornments",
              label: "Adornments (JSON array)",
              placeholder: '[{"file":{"url":"...","alt":""},"top":"10px","left":"20px"}]',
              multiline: true,
            },
          ],
        },
        {
          type: "specialComponent",
          label: "Special Component",
          icon: "link",
          description: "A special built-in component",
          fields: [
            {
              type: "select",
              action_id: "type",
              label: "Component",
              options: [{ label: "Riso Colors", value: "riso_colors" }],
            },
          ],
        },
      ],
    },
  });
}

export default createPlugin;
