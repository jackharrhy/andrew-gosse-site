import { on, type Handle } from "remix/ui";
import type {
  ContentBlock,
  Media,
  Adornment,
} from "../../../ui/public/content-types.ts";
import { ImageFields } from "./image-fields.tsx";
import { RichText } from "./rich-text.tsx";

export function BlockFields(
  handle: Handle<{
    block: ContentBlock;
    media: Media[];
    adornments: Adornment[];
    change: () => void;
    epoch: number;
    previewLayout?: { width: number; fontSize: number };
  }>,
) {
  function set(key: string, value: unknown) {
    handle.props.block.props[key] = value;
    handle.props.change();
    handle.update();
  }
  return () => {
    const { block: b, media, adornments } = handle.props,
      p = b.props;
    if (
      [
        "paragraph",
        "heading",
        "quote",
        "bulletListItem",
        "numberedListItem",
      ].includes(b.type)
    )
      return (
        <>
          {b.type === "heading" && (
            <label className="compact-field">
              Heading size
              <select
                value={p.level ?? 2}
                mix={on("change", (e) =>
                  set("level", Number(e.currentTarget.value)),
                )}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option value={n}>Heading {n}</option>
                ))}
              </select>
            </label>
          )}
          <RichText
            key={handle.props.epoch}
            content={b.content ?? []}
            label={b.type + " content"}
            change={(content) => {
              b.content = content;
              handle.props.change();
            }}
          />
        </>
      );
    if (b.type === "markdown")
      return (
        <label>
          Markdown & embed HTML
          <textarea
            className="code-input"
            rows={Math.min(
              16,
              Math.max(4, String(p.body ?? "").split("\n").length + 1),
            )}
            value={p.body ?? ""}
            spellCheck={false}
            mix={on("input", (e) => set("body", e.currentTarget.value))}
          />
          <small>
            Supports Markdown, styled HTML, and YouTube, Vimeo, Bandcamp or
            SoundCloud embeds.
          </small>
        </label>
      );
    if (b.type === "media")
      return (
        <ImageFields
          block={b}
          media={media}
          adornments={adornments}
          change={handle.props.change}
          previewLayout={handle.props.previewLayout}
        />
      );
    if (b.type === "special")
      return (
        <div className="special-block">
          <strong>Riso color collection</strong>
          <p className="muted">Visitors can copy each ink color.</p>
        </div>
      );
    if (b.type === "divider") return <hr />;
    return (
      <p className="notice">
        Unsupported block: {b.type}. Saved without changes.
      </p>
    );
  };
}
