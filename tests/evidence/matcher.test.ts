import { describe, expect, it, vi } from "vitest";

import { matchClaim } from "../../src/lib/evidence/matcher";
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

describe("matchClaim", () => {
  it("ranks the Russia-region myth first and explains the myth match", () => {
    const matches = matchClaim(
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

  it("scores a query containing the complete myth as containment", () => {
    const matches = matchClaim(
      "Kazakhstan is part of Russia today",
      records,
    );

    expect(matches[0]?.record.slug).toBe("part-of-russia");
    expect(matches[0]?.score).toBe(0.92);
    expect(matches[0]?.reasons).toContainEqual({
      field: "myth",
      label: "Kazakhstan is part of Russia",
    });
  });

  it("returns no results for generic, weak, or unrelated input", () => {
    expect(matchClaim("tell me something interesting", records)).toEqual([]);
    expect(matchClaim("weather tomorrow", records)).toEqual([]);
    expect(matchClaim("best hotels", records)).toEqual([]);
    expect(matchClaim("hello Kazakhstan", records)).toEqual([]);
    expect(matchClaim("Kazakhstan", records)).toEqual([]);
  });

  it("sorts equal alias matches by slug", () => {
    expect(
      matchClaim("shared equal alias phrase", records).map(
        ({ record }) => record.slug,
      ),
    ).toEqual(["capital-astana", "part-of-russia"]);
  });

  it("rejects external URLs without attempting network behavior", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(
      matchClaim("https://example.com/viral-post", records),
    ).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects all Qazaq Lens URLs without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(
      matchClaim(
        "https://qazaqlens.org/myths/part-of-russia/",
        records,
      ),
    ).toEqual([]);
    expect(
      matchClaim(
        "https://qazaqlens.org/kazakhstan-part-russia",
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
      matchClaim("What is the capital of Kazakhstan", manyRecords),
    ).toHaveLength(5);
    expect(
      matchClaim("What is the capital of Kazakhstan", manyRecords, 99),
    ).toHaveLength(5);
    expect(
      matchClaim("What is the capital of Kazakhstan", manyRecords, 2),
    ).toHaveLength(2);
  });

  it("is deterministic, rounds scores, and does not mutate records", () => {
    const before = structuredClone(records);
    const first = matchClaim("Is Kazakhstan a region of Russia?", records);

    for (let call = 0; call < 5; call += 1) {
      expect(
        matchClaim("Is Kazakhstan a region of Russia?", records),
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

    const [match] = matchClaim(
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
