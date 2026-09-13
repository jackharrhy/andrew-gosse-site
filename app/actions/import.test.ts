import { it } from "remix/test";
import * as assert from "remix/assert";
import { markdownToBlocks } from "../../scripts/markdown-to-blocks.ts";
it("preserves deep headings, inline images and nested lists during future imports", () => {
  const heading = markdownToBlocks("###### Heading")[0];
  assert.ok(heading.type === "heading");
  if (heading.type === "heading") assert.equal(heading.props.level, 6);
  for (const source of [
    "Photo ![alt](https://example.test/image.png)",
    "- Parent\n  - Child\n",
  ]) {
    const block = markdownToBlocks(source)[0];
    assert.equal(block.type, "markdown");
    assert.equal(block.props.body, source);
  }
});
