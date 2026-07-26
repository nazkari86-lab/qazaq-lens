import type { EvidenceCadence, EvidenceHealthResult, PublicationStatus } from "./types";

type Source = { publisher: string; type: string; publishedAt?: string; archivedUrl?: string; independenceGroup?: string };
type Claim = { significance: "critical" | "supporting"; confidence: "high" | "medium" | "low" };
export interface HealthInput {
  lastReviewedAt: Date;
  evidenceCadence?: EvidenceCadence;
  publicationStatus: PublicationStatus;
  reviewedBy: string[];
  sources: Source[];
  claims: Claim[];
}

const REVIEW_DUE_DAYS: Record<EvidenceCadence, number> = { current: 90, slow: 365, historical: 730 };

export function calculateEvidenceHealth(input: HealthInput, now = new Date()): EvidenceHealthResult {
  const cadence = input.evidenceCadence ?? "slow";
  const days = Math.max(0, Math.floor((now.valueOf() - input.lastReviewedAt.valueOf()) / 86_400_000));
  const dueDays = REVIEW_DUE_DAYS[cadence];
  const state = days <= Math.floor(dueDays * 0.75) ? "current" : days <= dueDays ? "review-soon" : "overdue";
  const counts = input.sources.reduce<Record<string, number>>((all, source) => ({ ...all, [source.type]: (all[source.type] ?? 0) + 1 }), {});
  const publishers = new Set(input.sources.map((source) => source.publisher)).size;
  const independenceGroups = new Set(input.sources.map((source) => source.independenceGroup ?? source.publisher)).size;
  const sourceFreshness = { current: 0, aging: 0, stale: 0, unknown: 0 };
  input.sources.forEach((source) => {
    if (!source.publishedAt) { sourceFreshness.unknown += 1; return; }
    if (cadence === "historical") { sourceFreshness.current += 1; return; }
    const age = Math.max(0, Math.floor((now.valueOf() - new Date(source.publishedAt).valueOf()) / 86_400_000));
    const agingAt = cadence === "current" ? 365 : 1095;
    const staleAt = cadence === "current" ? 730 : 1825;
    if (age > staleAt) sourceFreshness.stale += 1;
    else if (age > agingAt) sourceFreshness.aging += 1;
    else sourceFreshness.current += 1;
  });
  const critical = input.claims.filter((claim) => claim.significance === "critical");
  const lowConfidenceCritical = critical.filter((claim) => claim.confidence === "low").length;
  const archives = { covered: input.sources.filter((source) => Boolean(source.archivedUrl)).length, total: input.sources.length };
  const externalReview = { status: input.publicationStatus === "reviewed" ? "reviewed" as const : "pending" as const, reviewers: input.reviewedBy };
  const warnings: EvidenceHealthResult["warnings"] = [];
  if (state === "overdue") warnings.push({ code: "review-overdue", severity: "warning", message: `Editorial review is overdue for this ${cadence}-cadence topic.` });
  if (lowConfidenceCritical) warnings.push({ code: "critical-low-confidence", severity: "warning", message: `${lowConfidenceCritical} critical claim${lowConfidenceCritical === 1 ? "" : "s"} has low confidence.` });
  if (independenceGroups < 2) warnings.push({ code: "single-independence-group", severity: "warning", message: "The listed sources trace to fewer than two independence groups." });
  if (cadence === "current" && sourceFreshness.unknown) warnings.push({ code: "missing-published-date", severity: "notice", message: "Some current-topic sources have no publication date." });
  if (!archives.covered) warnings.push({ code: "missing-archive", severity: "notice", message: "No archive links are recorded for these sources." });
  if (externalReview.status === "pending") warnings.push({ code: "external-review-pending", severity: "notice", message: "Independent human review is still pending." });
  return { review: { days, dueDays, state }, diversity: { publishers, sourceTypes: Object.keys(counts).length, independenceGroups, counts }, sourceFreshness, claims: { critical: critical.length, lowConfidenceCritical }, archives, externalReview, warnings };
}
