import { getVisibleMyths } from "../../lib/content";
export async function GET() {
  const myths = await getVisibleMyths();
  const data = myths.flatMap((myth) => myth.data.claims.map((claim) => ({ article: myth.data.slug, articleTitle: myth.data.title, claimId: claim.id, statement: claim.statement, kind: claim.kind, confidence: claim.confidence, sources: claim.sourceIds, lastReviewedAt: myth.data.lastReviewedAt.toISOString() })));
  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), articles: myths.length, claims: data }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
