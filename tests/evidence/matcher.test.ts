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

const realisticRecords: EvidenceRegistryRecord[] = [
  {
    ...partOfRussia,
    slug: "secular-muslim",
    title: "Kazakhstan Is Muslim-Majority and Constitutionally Secular",
    mythStatement:
      "Kazakhstan is either an Islamic state or a country with no religious life",
    summary:
      "Misleading. Islam is important to Kazakhstan's history and population, but the constitution defines the state as secular and protects freedom of religion. Neither an Islamic-state label nor a claim that religion is absent describes the country well.",
    canonicalUrl: "https://qazaqlens.org/myths/secular-muslim/",
    aliases: ["Is Kazakhstan secular", "Religion in Kazakhstan"],
    topics: ["Religion", "Society"],
    claims: [
      {
        id: "C1",
        statement:
          "Islam is the majority religious tradition in Kazakhstan, while other religious communities also live and worship in the country.",
        significance: "critical",
        confidence: "high",
      },
    ],
  },
  {
    ...partOfRussia,
    slug: "almaty-earthquake",
    title: "Almaty Has a Significant and Well-Documented Earthquake Risk",
    mythStatement: "Almaty is not seriously at risk from earthquakes",
    summary:
      "False. Almaty is officially classified in Kazakhstan's highest seismic hazard zone. The city sits near active faults in the Tian Shan mountain system, has experienced destructive earthquakes historically, and records several hundred minor tremors per year. Authorities maintain earthquake preparedness plans and seismic monitoring systems.",
    canonicalUrl: "https://qazaqlens.org/myths/almaty-earthquake/",
    aliases: ["Almaty earthquake prediction", "Is Almaty earthquake safe"],
    topics: ["Almaty", "Earthquakes", "Risk"],
    claims: [
      {
        id: "C1",
        statement:
          "Major earthquakes struck the Almaty region in 1887 (estimated M7.3) and 1911 (estimated M8.0–8.2), causing significant casualties and destroying much of the city.",
        significance: "critical",
        confidence: "high",
      },
    ],
  },
  {
    ...partOfRussia,
    slug: "country-size",
    title: "Kazakhstan Is the World's Ninth-Largest Country",
    mythStatement: "Kazakhstan is a small or minor country",
    summary:
      "False. Kazakhstan covers 2,724,900 km² — the ninth-largest country on Earth by area and the largest landlocked country in the world. Its territory exceeds the combined area of France, Germany, Spain, Italy, the UK, Poland, and Sweden together. A population of approximately 20 million gives it a low density, which is sometimes misread as small size.",
    canonicalUrl: "https://qazaqlens.org/myths/country-size/",
    aliases: ["Kazakhstan land area", "How large is Kazakhstan"],
    topics: ["Geography", "Size"],
    claims: [
      {
        id: "C1",
        statement:
          "Kazakhstan covers 2,724,900 km², making it the ninth-largest country in the world by land area.",
        significance: "critical",
        confidence: "high",
      },
    ],
  },
  {
    ...partOfRussia,
    slug: "horse-meat-kumys",
    title: "Kazakhstan Is Not Defined by Horse Meat and Kumys",
    mythStatement:
      "People in Kazakhstan eat horse meat and drink fermented mare's milk every day",
    summary:
      "Misleading. Horse meat, kazy and kumys are important parts of Kazakh culinary heritage, but a traditional food is not a complete description of what every person eats or drinks in contemporary Kazakhstan.",
    canonicalUrl: "https://qazaqlens.org/myths/horse-meat-kumys/",
    aliases: ["Kazakh horse meat", "Does everyone drink kumys"],
    topics: ["Food", "Culture"],
    claims: [
      {
        id: "C1",
        statement:
          "Horse meat, kazy and kumys are recognised parts of Kazakh culinary and horse-breeding heritage.",
        significance: "critical",
        confidence: "high",
      },
    ],
  },
  {
    ...partOfRussia,
    slug: "landlocked-isolated",
    title: "Landlocked Does Not Mean Isolated",
    mythStatement: "Kazakhstan has no sea and is cut off from the world",
    summary:
      "Misleading. Kazakhstan is the world's largest landlocked country, but it borders the Caspian Sea and sits at the intersection of major rail, road, energy and trade routes linking China, Russia, Central Asia and Europe.",
    canonicalUrl: "https://qazaqlens.org/myths/landlocked-isolated/",
    aliases: ["Is Kazakhstan isolated", "Kazakhstan sea access"],
    topics: ["Geography", "Trade"],
    claims: [
      {
        id: "C1",
        statement:
          "Kazakhstan is the world's largest landlocked country and also borders the Caspian Sea.",
        significance: "critical",
        confidence: "high",
      },
    ],
  },
  {
    ...partOfRussia,
    slug: "yurts",
    title: "Most Kazakhstanis Do Not Live in Yurts",
    mythStatement: "People in Kazakhstan mostly live in yurts.",
    summary:
      "False. The yurt is important living heritage and remains culturally meaningful, but Kazakhstan is a predominantly urban country and most residents live in permanent modern housing.",
    canonicalUrl: "https://qazaqlens.org/myths/yurts/",
    aliases: ["Do Kazakhs live in yurts", "Kazakhstan yurt homes"],
    topics: ["Culture", "Housing"],
    claims: [
      {
        id: "C1",
        statement:
          "A majority of Kazakhstan's population lives in urban areas rather than in nomadic dwellings.",
        significance: "critical",
        confidence: "high",
      },
    ],
  },
];

const nuclearWeapons: EvidenceRegistryRecord = {
  ...partOfRussia,
  slug: "nuclear-weapons",
  title: "Kazakhstan Does Not Still Possess Nuclear Weapons",
  mythStatement: "Kazakhstan is a nuclear-armed state",
  summary:
    "Historically accurate but now false. Kazakhstan inherited the fourth-largest nuclear arsenal on earth when the Soviet Union collapsed in 1991. It then voluntarily transferred or dismantled all of those weapons by 1995.",
  canonicalUrl: "https://qazaqlens.org/myths/nuclear-weapons/",
  aliases: [
    "does Kazakhstan have nuclear weapons",
    "Kazakhstan nuclear arsenal",
  ],
  topics: ["History", "Statehood", "Society"],
  claims: [
    {
      id: "C1",
      statement:
        "Kazakhstan transferred all nuclear weapons to Russia and acceded to the Nuclear Non-Proliferation Treaty as a non-nuclear weapons state, completing the process in 1995.",
      significance: "critical",
      confidence: "high",
    },
  ],
};

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

  it.each(["country state", "major city", "world country"])(
    "rejects generic two-token query %j against realistic long fields",
    (query) => {
      expect(matchClaim(query, realisticRecords)).toEqual([]);
    },
  );

  it.each(["people in", "country with", "state or", "has no"])(
    "does not treat short sequence %j inside a long field as containment",
    (query) => {
      expect(matchClaim(query, realisticRecords)).toEqual([]);
    },
  );

  it("ranks the nuclear-weapons claim without function-word-only lower matches", () => {
    const functionWordDistractor: EvidenceRegistryRecord = {
      ...capitalAstana,
      slug: "function-word-distractor",
      aliases: ["Kazakhstan and others have", "unrelated fixture phrase"],
    };

    expect(
      matchClaim("does Kazakhstan have nuclear weapons", [
        nuclearWeapons,
        functionWordDistractor,
        ...realisticRecords,
      ]).map(({ record }) => record.slug),
    ).toEqual(["nuclear-weapons"]);
  });

  it("sorts equal alias matches by slug", () => {
    expect(
      matchClaim("shared equal alias phrase", records).map(
        ({ record }) => record.slug,
      ),
    ).toEqual(["capital-astana", "part-of-russia"]);
  });

  it.each([
    "https://example.com/kazakhstan-part-russia",
    "https://example.com/kazakhstan part russia",
    "http:example.com/kazakhstan-part-russia",
    "https:example.com/kazakhstan-part-russia",
    "https:/example.com/kazakhstan-part-russia",
    "//example.com/kazakhstan-part-russia",
    "www.example.com/kazakhstan-part-russia",
    "example.com/kazakhstan-part-russia",
    "example.org/kazakhstan-part-russia",
    "пример.рф/kazakhstan-part-russia",
    "example.xn--p1ai/kazakhstan-part-russia",
    "example.com:8443/kazakhstan-part-russia",
    "localhost:4321/kazakhstan-part-russia",
    "192.168.1.10/kazakhstan-part-russia",
    "[2001:db8::1]:8080/kazakhstan-part-russia",
  ])("rejects host-like pasted input %j without fetching", (input) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(matchClaim(input, records)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    "Kazakhstan-v2.0-language",
    "20.25-million-Kazakhstanis",
  ])("treats compact dotted prose %j as matchable text", (input) => {
    const dottedProseRecord: EvidenceRegistryRecord = {
      ...capitalAstana,
      aliases: [
        "Kazakhstan-v2.0-language",
        "20.25-million-Kazakhstanis",
      ],
    };

    expect(matchClaim(input, [dottedProseRecord])[0]?.record.slug).toBe(
      "capital-astana",
    );
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

  it("does not reject normal prose merely because it has a period", () => {
    expect(
      matchClaim("Kazakhstan is part of Russia. Really?", records)[0]
        ?.record.slug,
    ).toBe("part-of-russia");
  });

  it.each([
    "https://",
    "example..com/kazakhstan-part-russia",
    "not a url.example sentence",
    "[not-ipv6]/kazakhstan-part-russia",
  ])("does not throw for malformed non-host input %j", (input) => {
    expect(() => matchClaim(input, records)).not.toThrow();
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

  it("accepts deeply frozen registry input without mutation", () => {
    const frozenRecords = structuredClone(records);
    for (const record of frozenRecords) {
      record.claims.forEach((claim) => Object.freeze(claim));
      Object.freeze(record.aliases);
      Object.freeze(record.topics);
      Object.freeze(record.claims);
      Object.freeze(record);
    }
    Object.freeze(frozenRecords);

    expect(
      matchClaim("Is Kazakhstan a region of Russia?", frozenRecords)[0]
        ?.record.slug,
    ).toBe("part-of-russia");
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

  it("deduplicates visibly identical reasons across different fields", () => {
    const repeatedAcrossFields: EvidenceRegistryRecord = {
      ...partOfRussia,
      mythStatement: "Kazakhstan is part of Russia",
      aliases: ["Kazakhstan is part of Russia", "shared equal alias phrase"],
    };

    const [match] = matchClaim(
      "Kazakhstan is part of Russia",
      [repeatedAcrossFields],
    );

    expect(match.reasons).toContainEqual({
      field: "myth",
      label: "Kazakhstan is part of Russia",
    });
    expect(
      match.reasons.filter(
        ({ label }) => label === "Kazakhstan is part of Russia",
      ),
    ).toHaveLength(1);
  });
});
