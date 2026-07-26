export type Verdict = "false" | "misleading" | "partly-true" | "outdated" | "unverified" | "disputed";
export type PublicationStatus = "beta" | "reviewed";
export interface RegistryClaim { id: string; statement: string; significance: "critical" | "supporting"; confidence: "high" | "medium" | "low"; }
export interface EvidenceRegistryRecord { slug: string; title: string; mythStatement: string; summary: string; verdict: Verdict; publicationStatus: PublicationStatus; lastReviewedAt: string; canonicalUrl: string; topics: string[]; aliases: string[]; claims: RegistryClaim[]; sourceCount: number; }
export interface MatchReason { field: "myth" | "title" | "alias" | "claim" | "topic" | "summary"; label: string; }
export interface ClaimMatch { record: EvidenceRegistryRecord; score: number; reasons: MatchReason[]; }
