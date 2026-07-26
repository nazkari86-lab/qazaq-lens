export const VERDICTS = ["false", "misleading", "partly-true", "outdated", "unverified", "disputed"] as const;
export const PUBLICATION_STATUSES = ["beta", "reviewed"] as const;
export const CLAIM_SIGNIFICANCE = ["critical", "supporting"] as const;
export const CLAIM_CONFIDENCE = ["high", "medium", "low"] as const;

export type Verdict = (typeof VERDICTS)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type ClaimSignificance = (typeof CLAIM_SIGNIFICANCE)[number];
export type ClaimConfidence = (typeof CLAIM_CONFIDENCE)[number];

export interface RegistryClaim {
  id: string;
  statement: string;
  significance: ClaimSignificance;
  confidence: ClaimConfidence;
}

export interface EvidenceRegistryRecord {
  slug: string;
  title: string;
  mythStatement: string;
  summary: string;
  verdict: Verdict;
  publicationStatus: PublicationStatus;
  lastReviewedAt: string;
  canonicalUrl: string;
  topics: string[];
  aliases: string[];
  claims: RegistryClaim[];
  sourceCount: number;
}

export interface MatchReason {
  field: "myth" | "title" | "alias" | "claim" | "topic" | "summary";
  label: string;
}

export interface ClaimMatch {
  record: EvidenceRegistryRecord;
  score: number;
  reasons: MatchReason[];
}
