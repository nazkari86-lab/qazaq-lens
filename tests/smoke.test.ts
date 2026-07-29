import { readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("discovers the current evidence collection", () => {
    const mythsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../src/data/myths");
    const explainers = readdirSync(mythsDirectory).filter((filename) => extname(filename) === ".mdx");
    expect(explainers.length).toBeGreaterThanOrEqual(35);
  });
});
