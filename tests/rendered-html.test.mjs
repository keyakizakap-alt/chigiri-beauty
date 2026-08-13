import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("declares development preview metadata for the rendered layout", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const renderedMetadata = '<meta name="codex-preview" content="development">';
  assert.match(layout, /"codex-preview": "development"/);
  assert.match(renderedMetadata, developmentPreviewMeta);
});
