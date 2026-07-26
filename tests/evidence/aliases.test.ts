import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const mythsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/data/myths",
);

function parseYamlScalar(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return JSON.parse(trimmed) as string;
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  return trimmed;
}

function splitInlineYamlArray(value: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;
  let escaped = false;

  for (const character of value.slice(1, -1)) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\" && quote === "\"") {
      current += character;
      escaped = true;
      continue;
    }

    if (character === "'" || character === "\"") {
      if (quote === character) {
        quote = undefined;
      } else if (!quote) {
        quote = character;
      }
      current += character;
      continue;
    }

    if (character === "," && !quote) {
      items.push(parseYamlScalar(current));
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    items.push(parseYamlScalar(current));
  }

  return items;
}

function extractAliases(source: string, filename: string): string[] {
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  expect(frontmatterMatch, `${filename} must have YAML frontmatter`).not.toBeNull();

  const lines = frontmatterMatch![1].split(/\r?\n/);
  const aliasesIndex = lines.findIndex((line) => /^aliases\s*:/.test(line));
  expect(aliasesIndex, `${filename} must define aliases`).toBeGreaterThanOrEqual(0);

  const declaration = lines[aliasesIndex];
  const inlineValue = declaration.slice(declaration.indexOf(":") + 1).trim();
  if (inlineValue) {
    expect(inlineValue, `${filename} aliases must be a YAML array`).toMatch(/^\[.*\]$/);
    return splitInlineYamlArray(inlineValue);
  }

  const aliases: string[] = [];
  for (const line of lines.slice(aliasesIndex + 1)) {
    const itemMatch = line.match(/^\s+-\s+(.+?)\s*$/);
    if (!itemMatch) {
      break;
    }
    aliases.push(parseYamlScalar(itemMatch[1]));
  }

  return aliases;
}

describe("curated myth aliases", () => {
  test("all 33 explainers have two trimmed, globally unique aliases", () => {
    const filenames = readdirSync(mythsDirectory)
      .filter((filename) => extname(filename) === ".mdx")
      .sort();
    expect(filenames).toHaveLength(33);

    const globalAliases = new Map<string, string>();

    for (const filename of filenames) {
      const source = readFileSync(join(mythsDirectory, filename), "utf8");
      const aliases = extractAliases(source, filename);
      expect(aliases, filename).toHaveLength(2);

      const normalizedAliases = aliases.map((alias) => alias.trim().toLowerCase());
      expect(new Set(normalizedAliases).size, filename).toBe(aliases.length);

      aliases.forEach((alias, aliasIndex) => {
        expect(alias, `${filename} alias ${aliasIndex + 1} must be trimmed`).toBe(alias.trim());
        expect(alias, `${filename} alias ${aliasIndex + 1} must not be empty`).not.toBe("");

        const normalizedAlias = normalizedAliases[aliasIndex];
        expect(
          globalAliases.has(normalizedAlias),
          `${filename} duplicates alias from ${globalAliases.get(normalizedAlias)}`,
        ).toBe(false);
        globalAliases.set(normalizedAlias, filename);
      });
    }

    expect(globalAliases.size).toBe(66);
  });
});
