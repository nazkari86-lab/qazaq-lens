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
  "бұл",
  "ли",
  "ме",
  "ма",
  "это",
  "является",
]);

const TOKEN_EQUIVALENTS: Record<string, string> = {
  "қазақстан": "kazakhstan",
  "қазақстанда": "kazakhstan",
  "қазақстанның": "kazakhstan",
  "казахстан": "kazakhstan",
  "казахстана": "kazakhstan",
  "казахстане": "kazakhstan",
  "ресей": "russia",
  "ресейдің": "russia",
  "россия": "russia",
  "россии": "russia",
  "россией": "russia",
  "бөлігі": "part",
  "часть": "part",
  "регион": "region",
  "астана": "astana",
  "алматы": "almaty",
  "столица": "capital",
  "астанасы": "capital",
  "ядролық": "nuclear",
  "ядерное": "nuclear",
  "ядерный": "nuclear",
  "қару": "weapons",
  "оружие": "weapons",
  "киіз": "yurt",
  "үй": "yurt",
  "юрте": "yurt",
  "юртах": "yurt",
  "юрты": "yurt",
};

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
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => TOKEN_EQUIVALENTS[token] ?? token);
}
