import { readFile } from "node:fs/promises";

import {
  ModuleKind,
  ScriptTarget,
  transpileModule,
} from "typescript";
import { describe, expect, it } from "vitest";

const askPageUrl = new URL("../src/pages/ask.astro", import.meta.url);

async function loadCanonicalSlugHelper() {
  const source = await readFile(askPageUrl, "utf8");
  const helper = source.match(
    /\/\/ ask-canonical-helper:start\s*([\s\S]*?)\s*\/\/ ask-canonical-helper:end/,
  )?.[1];

  expect(helper).toBeTruthy();
  const javascript = transpileModule(helper ?? "", {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2022,
    },
  }).outputText;

  return Function(
    `"use strict"; ${javascript}; return getCanonicalArticleSlug;`,
  )() as (value: string) => string | null;
}

describe("Ask page canonical URL policy", () => {
  it.each([
    ["https://qazaqlens.org/myths/part-of-russia/", "part-of-russia"],
    ["https://qazaqlens.org/myths/part-of-russia", "part-of-russia"],
    [
      "https://qazaqlens.org/myths/part-of-russia/?utm_source=share#evidence",
      "part-of-russia",
    ],
  ])("accepts canonical article URL %s", async (value, expectedSlug) => {
    const getCanonicalArticleSlug = await loadCanonicalSlugHelper();
    expect(getCanonicalArticleSlug(value)).toBe(expectedSlug);
  });

  it.each([
    "http://qazaqlens.org/myths/part-of-russia/",
    "https://www.qazaqlens.org/myths/part-of-russia/",
    "https://qazaqlens.org:8443/myths/part-of-russia/",
    "https://qazaqlens.org:443/myths/part-of-russia/",
    "https://@qazaqlens.org/myths/part-of-russia/",
    "https://reader@qazaqlens.org/myths/part-of-russia/",
    "https://reader:secret@qazaqlens.org/myths/part-of-russia/",
    "https://qazaqlens.org/about/",
    "https://example.com/myths/part-of-russia/",
  ])("rejects non-canonical URL %s", async (value) => {
    const getCanonicalArticleSlug = await loadCanonicalSlugHelper();
    expect(getCanonicalArticleSlug(value)).toBeNull();
  });

  it("labels lastReviewedAt as the article review date", async () => {
    const source = await readFile(askPageUrl, "utf8");
    expect(source).toContain('appendText(metadata, "dt", "Last reviewed")');
    expect(source).not.toContain('appendText(metadata, "dt", "Sources checked")');
  });
});
