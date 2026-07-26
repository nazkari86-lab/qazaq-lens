import { normalizeText, tokenize } from "./normalize";
import type {
  ClaimMatch,
  EvidenceRegistryRecord,
  MatchReason,
} from "./types";

const FIELD_WEIGHT = {
  myth: 1,
  title: 0.9,
  alias: 0.95,
  claim: 0.82,
  topic: 0.58,
  summary: 0.42,
} as const;

const MIN_SCORE = 0.46;
const MAX_RESULTS = 5;

type MatchField = MatchReason["field"];

interface ScoredField {
  field: MatchField;
  label: string;
  score: number;
  order: number;
}

function isExternalHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return url.hostname !== "qazaqlens.org";
  } catch {
    return false;
  }
}

function overlapScore(queryTokens: string[], fieldValue: string) {
  const fieldTokens = new Set(tokenize(fieldValue));
  const sharedTokens = new Set(
    queryTokens.filter((token) => fieldTokens.has(token)),
  );

  // A single shared word is too ambiguous for conservative evidence matching.
  if (sharedTokens.size < 2) {
    return 0;
  }

  return sharedTokens.size / new Set(queryTokens).size;
}

function scoreField(
  normalizedQuery: string,
  queryTokens: string[],
  fieldValue: string,
) {
  const normalizedField = normalizeText(fieldValue);
  if (!normalizedField) {
    return 0;
  }

  if (normalizedField === normalizedQuery) {
    return 1;
  }

  if (normalizedField.includes(normalizedQuery)) {
    return 0.92;
  }

  return overlapScore(queryTokens, fieldValue);
}

function getFields(record: EvidenceRegistryRecord) {
  const fields: Array<{ field: MatchField; label: string }> = [
    { field: "myth", label: record.mythStatement },
    { field: "title", label: record.title },
    ...record.aliases.map((label) => ({ field: "alias" as const, label })),
    ...record.claims.map(({ statement: label }) => ({
      field: "claim" as const,
      label,
    })),
    ...record.topics.map((label) => ({ field: "topic" as const, label })),
    { field: "summary", label: record.summary },
  ];

  return fields;
}

function scoreRecord(
  normalizedQuery: string,
  queryTokens: string[],
  record: EvidenceRegistryRecord,
) {
  const scoredFields = getFields(record).map(
    ({ field, label }, order): ScoredField => ({
      field,
      label,
      score:
        scoreField(normalizedQuery, queryTokens, label) * FIELD_WEIGHT[field],
      order,
    }),
  );
  const bestScore = Math.max(0, ...scoredFields.map(({ score }) => score));

  if (bestScore < MIN_SCORE) {
    return undefined;
  }

  const reasonThreshold = Math.max(MIN_SCORE, bestScore - 0.12);
  const seenReasons = new Set<string>();
  const reasons = scoredFields
    .filter(({ score }) => score >= reasonThreshold)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .filter(({ field, label }) => {
      const key = `${field}\u0000${normalizeText(label)}`;
      if (seenReasons.has(key)) {
        return false;
      }
      seenReasons.add(key);
      return true;
    })
    .slice(0, 3)
    .map(({ field, label }) => ({ field, label }));

  return {
    record,
    score: Number(bestScore.toFixed(3)),
    reasons,
  } satisfies ClaimMatch;
}

export function matchEvidence(
  query: string,
  records: readonly EvidenceRegistryRecord[],
  limit = MAX_RESULTS,
): ClaimMatch[] {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  if (
    normalizedQuery.length < 4 ||
    queryTokens.length < 2 ||
    isExternalHttpUrl(query.trim())
  ) {
    return [];
  }

  const resultLimit = Math.max(
    0,
    Math.min(MAX_RESULTS, Math.floor(limit)),
  );
  if (resultLimit === 0) {
    return [];
  }

  return records
    .map((record) => scoreRecord(normalizedQuery, queryTokens, record))
    .filter((match): match is ClaimMatch => match !== undefined)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.record.slug < b.record.slug
          ? -1
          : a.record.slug > b.record.slug
            ? 1
            : 0),
    )
    .slice(0, resultLimit);
}
