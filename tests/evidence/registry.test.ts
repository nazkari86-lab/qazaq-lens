import { expect, test, vi } from "vitest";

vi.mock("../../src/lib/content", () => ({
  getVisibleMyths: vi.fn(),
}));

import { toRegistryRecord } from "../../src/lib/evidence/registry";

test("toRegistryRecord projects normalized evidence metadata without article bodies", () => {
  const input = {
    slug: "borat",
    title: "Borat Is Fiction",
    mythStatement: "Borat shows the real Kazakhstan",
    summary: "A fictional satire is not a documentary.",
    verdict: "misleading",
    publicationStatus: "beta",
    lastReviewedAt: new Date("2026-07-20T00:00:00Z"),
    topics: ["Media"],
    aliases: ["is Borat accurate"],
    claims: [
      {
        id: "C1",
        statement: "The film was not shot as a documentary.",
        significance: "critical",
        confidence: "high",
      },
    ],
    sources: [{ id: "S1" }, { id: "S2" }],
    body: "must not leak",
  } satisfies Parameters<typeof toRegistryRecord>[0] & { body: string };

  const record = toRegistryRecord(input);

  expect(record.canonicalUrl).toBe("https://qazaqlens.org/myths/borat/");
  expect(record.lastReviewedAt).toBe("2026-07-20");
  expect(record.sourceCount).toBe(2);
  expect(record).not.toHaveProperty("body");
  expect(Object.keys(record)).toEqual([
    "slug",
    "title",
    "mythStatement",
    "summary",
    "verdict",
    "publicationStatus",
    "lastReviewedAt",
    "canonicalUrl",
    "topics",
    "aliases",
    "claims",
    "sourceCount",
  ]);
});
