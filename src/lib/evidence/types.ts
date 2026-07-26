export const VERDICTS = ["false", "misleading", "partly-true", "outdated", "unverified", "disputed"] as const;
export const PUBLICATION_STATUSES = ["beta", "reviewed"] as const;
export const CLAIM_SIGNIFICANCE = ["critical", "supporting"] as const;
export const CLAIM_CONFIDENCE = ["high", "medium", "low"] as const;

export type Verdict = (typeof VERDICTS)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export const EVIDENCE_CADENCES = ["historical", "slow", "current"] as const;
export type EvidenceCadence = (typeof EVIDENCE_CADENCES)[number];

export interface EvidenceWarning {
  code: "review-overdue" | "critical-low-confidence" | "single-independence-group" | "missing-published-date" | "missing-archive" | "external-review-pending";
  severity: "notice" | "warning";
  message: string;
}

export interface EvidenceHealthResult {
  review: { days: number; dueDays: number; state: "current" | "review-soon" | "overdue" };
  diversity: { publishers: number; sourceTypes: number; independenceGroups: number; counts: Record<string, number> };
  sourceFreshness: { current: number; aging: number; stale: number; unknown: number };
  claims: { critical: number; lowConfidenceCritical: number };
  archives: { covered: number; total: number };
  externalReview: { status: "pending" | "reviewed"; reviewers: string[] };
  warnings: EvidenceWarning[];
}
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
