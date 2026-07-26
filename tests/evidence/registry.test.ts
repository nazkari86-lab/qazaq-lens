import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../src/lib/content", () => ({
  getVisibleMyths: vi.fn(),
}));

import { getVisibleMyths, type MythEntry } from "../../src/lib/content";
import {
  getEvidenceRegistry,
  toRegistryRecord,
} from "../../src/lib/evidence/registry";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function createMythEntry(slug: string): MythEntry {
  return {
    id: `${slug}.mdx`,
    collection: "myths",
    body: `Article body for ${slug} must not leak.`,
    data: {
      slug,
      title: `Title for ${slug}`,
      mythStatement: `Myth statement for ${slug}`,
      summary: `A sufficiently detailed evidence summary for the ${slug} fixture.`,
      verdict: "misleading",
      publicationStatus: "beta",
      draft: false,
      publishedAt: new Date("2026-07-19T00:00:00Z"),
      lastReviewedAt: new Date("2026-07-20T00:00:00Z"),
      author: "Qazaq Lens",
      reviewStatus: "Claim-by-claim review complete",
      reviewedBy: [],
      featured: false,
      topics: [`Topic ${slug}`],
      aliases: [`alias ${slug}`],
      evidenceCadence: "slow",
      keyTakeaways: [
        `First sufficiently detailed takeaway for ${slug}.`,
        `Second sufficiently detailed takeaway for ${slug}.`,
      ],
      sources: [
        {
          id: "S1",
          title: `Primary source for ${slug}`,
          publisher: "Publisher One",
          accessedAt: new Date("2026-07-20T00:00:00Z"),
          url: `https://sources.example/${slug}/one`,
          language: "English",
          type: "primary",
        },
        {
          id: "S2",
          title: `Secondary source for ${slug}`,
          publisher: "Publisher Two",
          accessedAt: new Date("2026-07-20T00:00:00Z"),
          url: `https://sources.example/${slug}/two`,
          language: "English",
          type: "academic",
        },
      ],
      claims: [
        {
          id: "C1",
          statement: `A sufficiently detailed evidence claim for ${slug}.`,
          kind: "fact",
          significance: "critical",
          confidence: "high",
          sourceIds: ["S1", "S2"],
        },
      ],
      changelog: [
        {
          date: new Date("2026-07-20T00:00:00Z"),
          summary: "Initial evidence review",
        },
      ],
    },
  };
}

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

test("getEvidenceRegistry sorts and deeply projects visible myth entries", async () => {
  const zuluEntry = createMythEntry("zulu");
  const alphaEntry = createMythEntry("alpha");
  vi.mocked(getVisibleMyths).mockResolvedValue([zuluEntry, alphaEntry]);

  const records = await getEvidenceRegistry();

  expect(records.map(({ slug }) => slug)).toEqual(["alpha", "zulu"]);
  expect(records[0]).not.toHaveProperty("body");
  expect(records[0]).not.toHaveProperty("sources");
  expect(records[0].sourceCount).toBe(2);
  expect(JSON.stringify(records)).not.toContain("https://sources.example/");
  expect(JSON.stringify(records)).not.toContain('"S1"');

  expect(records[0].topics).not.toBe(alphaEntry.data.topics);
  expect(records[0].aliases).not.toBe(alphaEntry.data.aliases);
  expect(records[0].claims).not.toBe(alphaEntry.data.claims);
  expect(records[0].claims[0]).not.toBe(alphaEntry.data.claims[0]);

  records[0].topics.push("result-only topic");
  records[0].claims[0].statement = "Result-only claim mutation.";
  expect(alphaEntry.data.topics).toEqual(["Topic alpha"]);
  expect(alphaEntry.data.claims[0].statement).toBe(
    "A sufficiently detailed evidence claim for alpha.",
  );

  alphaEntry.data.aliases.push("fixture-only alias");
  alphaEntry.data.claims[0].confidence = "low";
  expect(records[0].aliases).toEqual(["alias alpha"]);
  expect(records[0].claims[0].confidence).toBe("high");
});
