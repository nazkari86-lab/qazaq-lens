const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "does",
  "has",
  "have",
  "in",
  "is",
  "of",
  "or",
  "the",
  "to",
  "was",
  "were",
  "with",
]);

export function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019'`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

export function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}
