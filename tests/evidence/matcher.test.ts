import { describe, expect, it, vi } from "vitest";

import { matchEvidence } from "../../src/lib/evidence/matcher";
import type { EvidenceRegistryRecord } from "../../src/lib/evidence/types";

const partOfRussia: EvidenceRegistryRecord = {
  slug: "part-of-russia",
  title: "Kazakhstan Is an Independent Country",
  mythStatement: "Kazakhstan is part of Russia",
  summary:
    "Kazakhstan has been a sovereign state since 1991 and is not a Russian region.",
  verdict: "false",
  publicationStatus: "reviewed",
  lastReviewedAt: "2026-07-20",
  canonicalUrl: "https://qazaqlens.org/myths/part-of-russia/",
  topics: ["Kazakhstan", "Russia", "independence"],
  aliases: [
    "Is Kazakhstan controlled by Russia",
    "shared equal alias phrase",
  ],
  claims: [
    {
      id: "C1",
      statement: "Kazakhstan declared independence in 1991.",
      significance: "critical",
      confidence: "high",
    },
    {
      id: "C2",
      statement: "Kazakhstan is not a federal subject of Russia.",
      significance: "critical",
      confidence: "high",
    },
  ],
  sourceCount: 4,
};

const capitalAstana: EvidenceRegistryRecord = {
  slug: "capital-astana",
  title: "Astana Is the Capital of Kazakhstan",
  mythStatement: "Almaty is still Kazakhstan's capital",
  summary:
    "Astana has been Kazakhstan's capital since 1997, though Almaty remains its largest city.",
  verdict: "outdated",
  publicationStatus: "reviewed",
  lastReviewedAt: "2026-07-20",
  canonicalUrl: "https://qazaqlens.org/myths/capital-astana/",
  topics: ["Kazakhstan", "Astana", "capital"],
  aliases: [
    "What is the capital of Kazakhstan",
    "shared equal alias phrase",
  ],
  claims: [
    {
      id: "C1",
      statement: "Astana became the capital of Kazakhstan in 1997.",
      significance: "critical",
      confidence: "high",
    },
    {
      id: "C2",
      statement: "Almaty is Kazakhstan's largest city.",
      significance: "supporting",
      confidence: "high",
    },
  ],
  sourceCount: 3,
};

const records = [partOfRussia, capitalAstana];

describe("matchEvidence", () => {
  it("ranks the Russia-region myth first and explains the myth match", () => {
    const matches = matchEvidence(
      "Is Kazakhstan a region of Russia?",
      records,
    );

    expect(matches[0]?.record.slug).toBe("part-of-russia");
    expect(matches[0]?.score).toBe(0.667);
    expect(matches[0]?.reasons).toContainEqual({
      field: "myth",
      label: "Kazakhstan is part of Russia",
    });
  });

  it("returns no results for generic, weak, or unrelated input", () => {
    expect(matchEvidence("tell me something interesting", records)).toEqual([]);
    expect(matchEvidence("weather tomorrow", records)).toEqual([]);
    expect(matchEvidence("best hotels", records)).toEqual([]);
    expect(matchEvidence("hello Kazakhstan", records)).toEqual([]);
    expect(matchEvidence("Kazakhstan", records)).toEqual([]);
  });

  it("sorts equal alias matches by slug", () => {
    expect(
      matchEvidence("shared equal alias phrase", records).map(
        ({ record }) => record.slug,
      ),
    ).toEqual(["capital-astana", "part-of-russia"]);
  });

  it("rejects external URLs without attempting network behavior", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(
      matchEvidence("https://example.com/viral-post", records),
    ).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not special-case or fetch canonical Qazaq Lens URLs", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(
      matchEvidence(
        "https://qazaqlens.org/myths/part-of-russia/",
        records,
      ),
    ).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("defaults to five results and respects an explicit limit", () => {
    const manyRecords = Array.from({ length: 7 }, (_, index) => ({
      ...capitalAstana,
      slug: `capital-${String(index + 1).padStart(2, "0")}`,
      canonicalUrl: `https://qazaqlens.org/myths/capital-${index + 1}/`,
      aliases: [...capitalAstana.aliases],
      topics: [...capitalAstana.topics],
      claims: capitalAstana.claims.map((claim) => ({ ...claim })),
    }));

    expect(
      matchEvidence("What is the capital of Kazakhstan", manyRecords),
    ).toHaveLength(5);
    expect(
      matchEvidence("What is the capital of Kazakhstan", manyRecords, 99),
    ).toHaveLength(5);
    expect(
      matchEvidence("What is the capital of Kazakhstan", manyRecords, 2),
    ).toHaveLength(2);
  });

  it("is deterministic, rounds scores, and does not mutate records", () => {
    const before = structuredClone(records);
    const first = matchEvidence("Is Kazakhstan a region of Russia?", records);

    for (let call = 0; call < 5; call += 1) {
      expect(
        matchEvidence("Is Kazakhstan a region of Russia?", records),
      ).toEqual(first);
    }

    expect(first.every(({ score }) => /^\d+\.\d{3}$/.test(score.toFixed(3)))).toBe(
      true,
    );
    expect(records).toEqual(before);
  });

  it("deduplicates repeated identical reason fields", () => {
    const repeated: EvidenceRegistryRecord = {
      ...partOfRussia,
      aliases: [
        "Is Kazakhstan a region of Russia",
        "Is Kazakhstan a region of Russia",
      ],
    };

    const [match] = matchEvidence(
      "Is Kazakhstan a region of Russia",
      [repeated],
    );
    const aliasReasons = match.reasons.filter(
      ({ field, label }) =>
        field === "alias" && label === "Is Kazakhstan a region of Russia",
    );

    expect(aliasReasons).toHaveLength(1);
    expect(match.reasons.length).toBeLessThanOrEqual(3);
  });
});
