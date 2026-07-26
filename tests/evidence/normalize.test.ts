import { describe, expect, it } from "vitest";

import {
  normalizeText,
  tokenize,
} from "../../src/lib/evidence/normalize";

describe("normalizeText", () => {
  it.each([
    ["  Is Kazakhstan—part of RUSSIA? ", "is kazakhstan part of russia"],
    ["Qazaqstan’s capital", "qazaqstans capital"],
    ["Казахстан — часть России?", "казахстан часть россии"],
  ])("normalizes %j deterministically", (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it("returns an empty string for empty and punctuation-only input", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(" —?!… ")).toBe("");
  });

  it("normalizes composed and decomposed Unicode identically", () => {
    expect(normalizeText("Café")).toBe("cafe");
    expect(normalizeText("Café")).toBe(normalizeText("Cafe\u0301"));
  });
});

describe("tokenize", () => {
  it("removes stop words and one-character tokens", () => {
    expect(tokenize("Is Kazakhstan part of Russia?")).toEqual([
      "kazakhstan",
      "part",
      "russia",
    ]);
  });

  it("returns no tokens for empty and punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize(" —?!… ")).toEqual([]);
  });
});
