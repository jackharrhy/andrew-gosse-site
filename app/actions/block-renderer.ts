import { parseAdornmentInstances } from "../ui/public/adornment-instances.ts";
import {
  imageStyle,
  imageGroupStyle,
  decoratedPhotoStyle,
  adornmentStyle,
} from "../ui/public/image-layout.ts";
import { marked } from "marked";
import sanitize from "sanitize-html";
import type {
  ContentBlock,
  Inline,
  Adornment,
} from "../ui/public/content-types.ts";
import { risoColors } from "./public/riso-colors.ts";

export const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const mediaUrl = (id: string | null | undefined) =>
  id ? `/tea/api/media/file/${encodeURIComponent(id)}` : "";
export function inlineHtml(content: Inline[] = []): string {
  return content
    .map((node) => {
      if (node.type === "link")
        return `<a href="${escape(node.href)}">${inlineHtml(node.content)}</a>`;
      let html = escape(node.text).replace(/\n/g, "<br>");
      const styles = node.styles ?? {};
      for (const [key, tag] of [
        ["bold", "strong"],
        ["italic", "em"],
        ["underline", "u"],
        ["strike", "s"],
        ["code", "code"],
      ])
        if (styles[key]) html = `<${tag}>${html}</${tag}>`;
      const css = [];
      if (styles.textColor && styles.textColor !== "default")
        css.push(`color:${styles.textColor}`);
      if (styles.backgroundColor && styles.backgroundColor !== "default")
        css.push(`background-color:${styles.backgroundColor}`);
      return css.length
        ? `<span style="${escape(css.join(";"))}">${html}</span>`
        : html;
    })
    .join("");
}
function css(values: Record<string, unknown>) {
  return escape(
    Object.entries(values)
      .filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => `${k}:${v}`)
      .join(";"),
  );
}
export function renderBlocks(
  blocks: ContentBlock[],
  adornments: Adornment[],
  preview = false,
): string {
  const library = new Map(adornments.map((a) => [a.name, a]));
  function render(items: ContentBlock[]): string {
    let html = "",
      list = "";
    for (const b of items) {
      const next =
        b.type === "bulletListItem"
          ? "ul"
          : b.type === "numberedListItem"
            ? "ol"
            : "";
      if (next !== list) {
        if (list) html += `</${list}>`;
        if (next) html += `<${next}>`;
        list = next;
      }
      const inner = inlineHtml(b.content),
        children = render(b.children ?? []),
        p = b.props;
      const align = ["left", "center", "right", "justify"].includes(
        p.textAlignment,
      )
        ? ` style="text-align:${p.textAlignment}"`
        : "";
      const start = html.length;
      switch (b.type) {
        case "paragraph":
          html += `<p${align}>${inner}</p>${children}`;
          break;
        case "heading": {
          const h = [1, 2, 3, 4, 5, 6].includes(p.level) ? p.level : 2;
          html += `<h${h}${align}>${inner}</h${h}>${children}`;
          break;
        }
        case "bulletListItem":
        case "numberedListItem":
          html += `<li${align}>${inner}${children}</li>`;
          break;
        case "quote":
          html += `<blockquote>${inner}${children}</blockquote>`;
          break;
        case "divider":
          html += "<hr>";
          break;
        case "markdown":
          html += marked.parse(String(p.body ?? ""), { async: false });
          break;
        case "media": {
          const decorations = (parseAdornmentInstances(p.adornments) ?? [])
            .map((r) => {
              const a = library.get(r.adornmentName);
              return a ? { ...a, css: { ...a.css, ...r.css } } : undefined;
            })
            .filter((a): a is Adornment => !!a?.media_id);
          if (decorations.length) {
            html += `<div class="image-with-adornments" style="${css(imageGroupStyle(p))}"><img src="${mediaUrl(p.mediaId)}" alt="${escape(p.alt)}" style="${css(decoratedPhotoStyle(p))}">`;
            for (const a of decorations)
              html += `<img class="adornment" src="${mediaUrl(a.media_id)}" alt="" style="${css(adornmentStyle(a.css))}">`;
            html += "</div>";
          } else
            html += `<img src="${mediaUrl(p.mediaId)}" alt="${escape(p.alt)}" style="${css(imageStyle(p))}">`;
          break;
        }
        case "special":
          if (p.type === "riso_colors")
            html += `<div class="riso-colors">${risoColors.map((c) => `<button type="button" data-color="${escape(c.color)}" style="background-color:${escape(c.color)}" aria-label="Copy ${escape(c.name)} color">${escape(c.name)}</button>`).join("")}</div>`;
          break;
        default:
          html += children;
      }
      if (preview && b.type !== "special") {
        html =
          html.slice(0, start) +
          html
            .slice(start)
            .replace(
              /^(<[a-z][\w:-]*)\b/i,
              `$1 data-preview-key="${escape(b.id)}"`,
            );
      }
    }
    if (list) html += `</${list}>`;
    return html;
  }
  return sanitize(render(blocks), {
    allowedTags: [
      ...sanitize.defaults.allowedTags,
      "img",
      "iframe",
      "button",
      "video",
      "audio",
      "source",
    ],
    allowedAttributes: {
      "*": [
        "style",
        "class",
        "id",
        "title",
        "aria-label",
        ...(preview ? ["data-preview-key"] : []),
      ],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      iframe: [
        "src",
        "width",
        "height",
        "title",
        "allow",
        "allowfullscreen",
        "frameborder",
        "referrerpolicy",
      ],
      button: ["type", "data-color"],
      video: ["src", "controls", "width", "height", "poster"],
      audio: ["src", "controls"],
      source: ["src", "type"],
    },
    allowedIframeHostnames: [
      "www.youtube.com",
      "www.youtube-nocookie.com",
      "player.vimeo.com",
      "bandcamp.com",
      "w.soundcloud.com",
    ],
    allowedIframeDomains: ["bandcamp.com"],
    allowIframeRelativeUrls: false,
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
}
