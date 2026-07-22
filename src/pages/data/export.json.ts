import { getVisibleMyths } from "../../lib/content";
export async function GET() {
  const myths = await getVisibleMyths();
  const data = myths.flatMap((myth) => myth.data.claims.map((claim) => ({ article: myth.data.slug, articleTitle: myth.data.title, topics: myth.data.topics, verdict: myth.data.verdict, claimId: claim.id, statement: claim.statement, kind: claim.kind, significance: claim.significance, confidence: claim.confidence, sources: claim.sourceIds, lastReviewedAt: myth.data.lastReviewedAt.toISOString() })));
  const sources = myths.flatMap((myth) => myth.data.sources.map((source) => ({ article: myth.data.slug, ...source, accessedAt: source.accessedAt.toISOString() })));
  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), articles: myths.length, claims: data, sources }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
