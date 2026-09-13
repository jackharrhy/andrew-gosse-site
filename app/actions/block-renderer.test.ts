import { it } from "remix/test";
import * as assert from "remix/assert";
import { renderBlocks } from "./block-renderer.ts";

it("renders nested styled content and trusted embeds without executable markup", () => {
  const html = renderBlocks(
    [
      {
        id: "1",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "Hello <world>", styles: { bold: true } },
        ],
        children: [
          {
            id: "2",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Child" }],
          },
        ],
      },
      {
        id: "3",
        type: "markdown",
        props: {
          body: '<script>alert(1)</script><iframe src="https://www.youtube.com/embed/test"></iframe><a href="javascript:alert(1)">bad</a>',
        },
      },
    ],
    [],
  );
  assert.match(html, /<strong>Hello &lt;world&gt;<\/strong>/);
  assert.match(html, /Child/);
  assert.match(html, /youtube.com\/embed\/test/);
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("javascript:"), false);
});
