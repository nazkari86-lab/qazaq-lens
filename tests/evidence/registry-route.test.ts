import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../src/lib/evidence/registry", () => ({
  getEvidenceRegistry: vi.fn(),
}));

import { getEvidenceRegistry } from "../../src/lib/evidence/registry";
import type { EvidenceRegistryRecord } from "../../src/lib/evidence/types";
import { GET } from "../../src/pages/data/registry.json";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

test("registry JSON route returns the versioned records envelope and cache headers", async () => {
  const records: EvidenceRegistryRecord[] = [
    {
      slug: "borat",
      title: "Borat Is Fiction",
      mythStatement: "Borat shows the real Kazakhstan",
      summary: "A fictional satire is not a documentary.",
      verdict: "misleading",
      publicationStatus: "beta",
      lastReviewedAt: "2026-07-20",
      canonicalUrl: "https://qazaqlens.org/myths/borat/",
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
      sourceCount: 2,
    },
  ];
  vi.mocked(getEvidenceRegistry).mockResolvedValue(records);

  const response = await GET();
  const payload = (await response.json()) as {
    schemaVersion: number;
    generatedAt: string;
    records: EvidenceRegistryRecord[];
  };

  expect(payload.schemaVersion).toBe(1);
  expect(Number.isNaN(Date.parse(payload.generatedAt))).toBe(false);
  expect(new Date(payload.generatedAt).toISOString()).toBe(payload.generatedAt);
  expect(payload.records).toEqual(records);
  expect(Object.keys(payload)).toEqual([
    "schemaVersion",
    "generatedAt",
    "records",
  ]);
  expect(response.headers.get("content-type")).toBe(
    "application/json; charset=utf-8",
  );
  expect(response.headers.get("cache-control")).toBe(
    "public, max-age=3600",
  );
  expect(getEvidenceRegistry).toHaveBeenCalledOnce();
});
