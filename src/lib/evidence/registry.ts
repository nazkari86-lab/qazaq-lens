import type { MythEntry } from "../content";
import { getVisibleMyths } from "../content";
import type { EvidenceRegistryRecord } from "./types";

type MythData = MythEntry["data"];
type RegistryInput = Omit<
  Pick<
    MythData,
    | "slug"
    | "title"
    | "mythStatement"
    | "summary"
    | "verdict"
    | "publicationStatus"
    | "lastReviewedAt"
    | "topics"
    | "aliases"
    | "claims"
    | "sources"
  >,
  "claims" | "sources"
> & {
  claims: ReadonlyArray<
    Pick<
      MythData["claims"][number],
      "id" | "statement" | "significance" | "confidence" | "sourceIds"
    >
  >;
  sources: ReadonlyArray<
    Pick<
      MythData["sources"][number],
      "id" | "title" | "publisher" | "url" | "type"
    >
  >;
};

const SOURCE_PRIORITY = {
  primary: 0,
  academic: 1,
  official: 2,
  journalistic: 3,
  background: 4,
} as const;

function selectTopSources(data: RegistryInput) {
  const criticalIds = new Set(
    data.claims
      .filter(({ significance }) => significance === "critical")
      .flatMap(({ sourceIds }) => sourceIds),
  );

  return data.sources
    .map((source, order) => ({ source, order }))
    .sort(
      (a, b) =>
        Number(criticalIds.has(b.source.id)) - Number(criticalIds.has(a.source.id)) ||
        SOURCE_PRIORITY[a.source.type] - SOURCE_PRIORITY[b.source.type] ||
        a.order - b.order,
    )
    .slice(0, 2)
    .map(({ source }) => ({ ...source }));
}

export function toRegistryRecord(data: RegistryInput): EvidenceRegistryRecord {
  return {
    slug: data.slug,
    title: data.title,
    mythStatement: data.mythStatement,
    summary: data.summary,
    verdict: data.verdict,
    publicationStatus: data.publicationStatus,
    lastReviewedAt: data.lastReviewedAt.toISOString().slice(0, 10),
    canonicalUrl: `https://qazaqlens.org/myths/${data.slug}/`,
    topics: [...data.topics],
    aliases: [...data.aliases],
    claims: data.claims.map(
      ({ id, statement, significance, confidence }) => ({
        id,
        statement,
        significance,
        confidence,
      }),
    ),
    topSources: selectTopSources(data),
    sourceCount: data.sources.length,
  };
}

export async function getEvidenceRegistry() {
  const entries = await getVisibleMyths();
  return entries
    .map((entry) => toRegistryRecord(entry.data))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
