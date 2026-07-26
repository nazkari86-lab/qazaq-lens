import { expect, test } from "vitest";

import type { EvidenceRegistryRecord } from "../../src/lib/evidence/types";

test("evidence registry records expose metadata without article bodies", () => {
  const record: EvidenceRegistryRecord = {
    slug: "part-of-russia",
    title: "Kazakhstan Is Not Part of Russia",
    mythStatement: "Kazakhstan is a region of Russia",
    summary: "Kazakhstan is a sovereign state.",
    verdict: "false",
    publicationStatus: "beta",
    lastReviewedAt: "2026-07-20",
    canonicalUrl: "https://qazaqlens.org/myths/part-of-russia/",
    topics: ["Geography"],
    aliases: ["is kazakhstan russian"],
    claims: [
      {
        id: "C1",
        statement: "Kazakhstan is a sovereign state.",
        significance: "critical",
        confidence: "high",
      },
    ],
    sourceCount: 4,
  };

  expect(record.claims[0].id).toBe("C1");
  expect(record).not.toHaveProperty("body");
});
