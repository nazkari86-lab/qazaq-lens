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

const DOMAIN_LIKE =
  /^(?:www\.)?(?:[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{M}\p{N}])?\.)+(?:xn--[a-z0-9-]{2,59}|\p{L}[\p{L}\p{M}]{1,62})\.?(?::\d{1,5})?(?:[/?#][^\s]*)?$/iu;
const IPV4_LIKE =
  /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:[/?#][^\s]*)?$/u;
const BRACKETED_IPV6_LIKE =
  /^\[[0-9a-f:.]+\](?::\d{1,5})?(?:[/?#][^\s]*)?$/iu;
const LOCALHOST_WITH_PORT =
  /^localhost:\d{1,5}(?:[/?#][^\s]*)?$/iu;

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function isHostLikeInput(value: string) {
  const candidate = value.trim();
  if (!candidate) {
    return false;
  }

  if (isValidHttpUrl(candidate)) {
    return true;
  }

  if (candidate.startsWith("//")) {
    return isValidHttpUrl(`https:${candidate}`);
  }

  if (/\s/u.test(candidate)) {
    return false;
  }

  if (
    !DOMAIN_LIKE.test(candidate) &&
    !IPV4_LIKE.test(candidate) &&
    !BRACKETED_IPV6_LIKE.test(candidate) &&
    !LOCALHOST_WITH_PORT.test(candidate)
  ) {
    return false;
  }

  return isValidHttpUrl(`http://${candidate}`);
}

function overlapScore(queryTokens: string[], fieldValue: string) {
  const queryTokenSet = new Set(queryTokens);
  const fieldTokens = new Set(tokenize(fieldValue));
  const sharedTokens = new Set(
    [...queryTokenSet].filter((token) => fieldTokens.has(token)),
  );

  // A single shared word is too ambiguous for conservative evidence matching.
  if (sharedTokens.size < 2) {
    return 0;
  }

  return (2 * sharedTokens.size) / (queryTokenSet.size + fieldTokens.size);
}

function containsTokenSequence(longer: string[], shorter: string[]) {
  for (let start = 0; start <= longer.length - shorter.length; start += 1) {
    if (
      shorter.every((token, offset) => token === longer[start + offset])
    ) {
      return true;
    }
  }

  return false;
}

function isStrongTokenContainment(
  queryTokens: string[],
  fieldTokens: string[],
) {
  const [shorter, longer] =
    queryTokens.length <= fieldTokens.length
      ? [queryTokens, fieldTokens]
      : [fieldTokens, queryTokens];

  return (
    shorter.length > 0 &&
    shorter.length / longer.length >= 0.6 &&
    containsTokenSequence(longer, shorter)
  );
}

function scoreField(
  normalizedQuery: string,
  queryTokens: string[],
  fieldValue: string,
) {
  const normalizedField = normalizeText(fieldValue);
  const fieldTokens = tokenize(fieldValue);
  if (!normalizedField) {
    return 0;
  }

  if (normalizedField === normalizedQuery) {
    return 1;
  }

  if (isStrongTokenContainment(queryTokens, fieldTokens)) {
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
    .filter(({ label }) => {
      const key = normalizeText(label);
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

export function matchClaim(
  query: string,
  records: readonly EvidenceRegistryRecord[],
  limit = MAX_RESULTS,
): ClaimMatch[] {
  if (isHostLikeInput(query)) {
    return [];
  }

  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  if (normalizedQuery.length < 4 || queryTokens.length < 2) {
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
