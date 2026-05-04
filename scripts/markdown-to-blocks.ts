// scripts/markdown-to-blocks.ts
// Converts markdown source (which may contain raw HTML) into TeaCMS BlockNote
// blocks. Strategy:
//   1. Split into top-level tokens via marked.lexer().
//   2. For each token, emit a native block (heading / paragraph / list / quote
//      / hr) with marks (bold, italic, link, code) parsed from inline tokens.
//   3. If a top-level token is `html` (raw HTML block) OR an inline html token
//      shows up inside a paragraph, fall back to a `markdown` escape-hatch
//      block containing the raw markdown source for that span — preserves
//      the styling exactly.
//
// Imported by scripts/migrate-from-strapi-to-teacms.ts.
import { marked, type Token } from "marked";
import { ulid } from "ulid";

interface Style {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
}

interface InlineText {
  type: "text";
  text: string;
  styles: Style;
}

interface InlineLink {
  type: "link";
  href: string;
  content: InlineText[];
}

type InlineContent = InlineText | InlineLink;

export type Block =
  | {
      id: string;
      type: "paragraph" | "heading" | "bulletListItem" | "numberedListItem" | "quote";
      props: Record<string, unknown>;
      content: InlineContent[];
      children: Block[];
    }
  | {
      id: string;
      type: "divider";
      props: Record<string, unknown>;
      content: [];
      children: [];
    }
  | {
      id: string;
      type: "markdown";
      props: { body: string };
      content: [];
      children: [];
    };

function block(b: Omit<Block, "id">): Block {
  return { id: ulid(), ...b } as Block;
}

function tokenContainsHtml(tokens: Token[]): boolean {
  for (const t of tokens) {
    if (t.type === "html") return true;
    if ("tokens" in t && Array.isArray(t.tokens)) {
      if (tokenContainsHtml(t.tokens)) return true;
    }
  }
  return false;
}

// Convert marked inline tokens into BlockNote inline content. Bold/italic/code
// nest, so we accumulate styles via the recursion path.
function inline(tokens: Token[], parentStyles: Style = {}): InlineContent[] {
  const out: InlineContent[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "text": {
        // marked sometimes nests further tokens here (e.g. for entity decoding)
        if ("tokens" in t && Array.isArray(t.tokens) && t.tokens.length > 0) {
          out.push(...inline(t.tokens as Token[], parentStyles));
        } else {
          out.push({ type: "text", text: (t as { text: string }).text, styles: { ...parentStyles } });
        }
        break;
      }
      case "escape": {
        out.push({ type: "text", text: (t as { text: string }).text, styles: { ...parentStyles } });
        break;
      }
      case "strong": {
        out.push(
          ...inline((t as { tokens: Token[] }).tokens, { ...parentStyles, bold: true })
        );
        break;
      }
      case "em": {
        out.push(
          ...inline((t as { tokens: Token[] }).tokens, { ...parentStyles, italic: true })
        );
        break;
      }
      case "del": {
        out.push(
          ...inline((t as { tokens: Token[] }).tokens, { ...parentStyles, strike: true })
        );
        break;
      }
      case "codespan": {
        out.push({
          type: "text",
          text: (t as { text: string }).text,
          styles: { ...parentStyles, code: true },
        });
        break;
      }
      case "link": {
        const linkTok = t as { href: string; tokens: Token[] };
        const linkContent = inline(linkTok.tokens, parentStyles);
        // Flatten any nested links/spans into plain text nodes for the link
        // children — BlockNote link content is just text nodes with styles.
        const flat: InlineText[] = [];
        for (const child of linkContent) {
          if (child.type === "text") flat.push(child);
          else flat.push(...child.content);
        }
        out.push({ type: "link", href: linkTok.href, content: flat });
        break;
      }
      case "image": {
        // Inline images aren't a thing in our schema. Drop to text fallback.
        const img = t as { text: string; href: string };
        out.push({
          type: "text",
          text: img.text || img.href,
          styles: { ...parentStyles },
        });
        break;
      }
      case "br": {
        out.push({ type: "text", text: "\n", styles: { ...parentStyles } });
        break;
      }
      default: {
        // Unknown inline token — capture its raw text best-effort.
        const raw = "raw" in t ? (t as { raw: string }).raw : "";
        if (raw) out.push({ type: "text", text: raw, styles: { ...parentStyles } });
      }
    }
  }
  return out;
}

function escapeHatch(raw: string): Block {
  return block({
    type: "markdown",
    props: { body: raw },
    content: [],
    children: [],
  });
}

/**
 * Convert markdown source (possibly with embedded HTML) into TeaCMS blocks.
 *
 * Returns a list of Block. Headings/paragraphs/lists/quotes/hr are native;
 * any token containing raw HTML is preserved as a `markdown` block.
 */
export function markdownToBlocks(source: string): Block[] {
  if (!source || !source.trim()) return [];

  const tokens = marked.lexer(source);
  const out: Block[] = [];

  for (const tok of tokens) {
    // Top-level raw HTML → escape hatch
    if (tok.type === "html") {
      out.push(escapeHatch(tok.raw));
      continue;
    }

    // Spaces between blocks — ignore
    if (tok.type === "space") continue;

    // Inline blocks may contain raw HTML — escape hatch the whole thing
    if ("tokens" in tok && Array.isArray(tok.tokens) && tokenContainsHtml(tok.tokens as Token[])) {
      out.push(escapeHatch(tok.raw));
      continue;
    }

    switch (tok.type) {
      case "heading": {
        const h = tok as { depth: number; tokens: Token[] };
        const level = Math.min(Math.max(h.depth, 1), 3) as 1 | 2 | 3;
        out.push(
          block({
            type: "heading",
            props: { level },
            content: inline(h.tokens),
            children: [],
          })
        );
        break;
      }
      case "paragraph": {
        const p = tok as { tokens: Token[] };
        out.push(
          block({
            type: "paragraph",
            props: {},
            content: inline(p.tokens),
            children: [],
          })
        );
        break;
      }
      case "blockquote": {
        const q = tok as { tokens: Token[] };
        // Flatten quoted paragraphs into a single quote block — multi-paragraph
        // quotes lose their paragraph breaks, which is acceptable for the
        // small number of quotes in this dataset.
        const inner: InlineContent[] = [];
        for (const child of q.tokens) {
          if ("tokens" in child && Array.isArray(child.tokens)) {
            if (inner.length > 0) inner.push({ type: "text", text: "\n", styles: {} });
            inner.push(...inline(child.tokens as Token[]));
          }
        }
        out.push(
          block({
            type: "quote",
            props: {},
            content: inner,
            children: [],
          })
        );
        break;
      }
      case "list": {
        const list = tok as {
          ordered: boolean;
          items: { tokens: Token[]; raw: string }[];
        };
        const itemType = list.ordered ? "numberedListItem" : "bulletListItem";
        for (const item of list.items) {
          // Each item's first token block is typically a "text" block; flatten
          // its inline tokens if present.
          let itemInline: InlineContent[] = [];
          for (const child of item.tokens) {
            if (child.type === "text" && "tokens" in child && Array.isArray(child.tokens)) {
              itemInline = inline(child.tokens as Token[]);
              break;
            }
            if (child.type === "paragraph" && "tokens" in child && Array.isArray(child.tokens)) {
              itemInline = inline(child.tokens as Token[]);
              break;
            }
          }
          if (itemInline.length === 0) {
            // Couldn't extract — fall back to escape-hatch for this item
            out.push(escapeHatch(item.raw));
            continue;
          }
          out.push(
            block({
              type: itemType,
              props: {},
              content: itemInline,
              children: [],
            })
          );
        }
        break;
      }
      case "hr": {
        out.push(
          block({
            type: "divider",
            props: {},
            content: [],
            children: [],
          })
        );
        break;
      }
      case "code": {
        const c = tok as { text: string; lang?: string };
        // No native code block in our schema; fall back to a paragraph with
        // code-styled text. Multi-line preserved via newlines.
        out.push(
          block({
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: c.text, styles: { code: true } }],
            children: [],
          })
        );
        break;
      }
      default: {
        // Unknown top-level token → escape hatch
        if ("raw" in tok && typeof tok.raw === "string" && tok.raw.trim()) {
          out.push(escapeHatch(tok.raw));
        }
      }
    }
  }

  return out;
}
