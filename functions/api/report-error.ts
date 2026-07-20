interface Env { QAZAQ_LENS_DB?: D1Database; }
interface CorrectionPayload {
  pageUrl: string; pageTitle?: string; issue: string; reason: string; sourceUrl: string; sourceTitle?: string;
  suggestion?: string; name?: string; email?: string; mayCredit?: boolean; website?: string; startedAt?: number; locale?: string;
}
const json = (data: unknown, status = 200, extra: Record<string,string> = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...extra } });
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0,max) : "";
const validUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } };
const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return json({ message:"Cross-site submissions are not accepted." },403);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return json({ message:"Content type must be application/json." },415);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 32_000) return json({ message:"Submission is too large." },413);

  let input: CorrectionPayload;
  try { input = await request.json<CorrectionPayload>(); } catch { return json({ message:"Invalid JSON request." },400); }
  if (clean(input.website,200)) return json({ ok:true,id:"accepted" });
  const elapsed = Date.now() - Number(input.startedAt ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < 2500 || elapsed > 86_400_000) return json({ message:"Please reload the form and try again." },400);

  const pageUrl=clean(input.pageUrl,500), pageTitle=clean(input.pageTitle,250), issue=clean(input.issue,2000), reason=clean(input.reason,3000);
  const sourceUrl=clean(input.sourceUrl,500), sourceTitle=clean(input.sourceTitle,250), suggestion=clean(input.suggestion,3000);
  const name=clean(input.name,120), email=clean(input.email,200), locale=clean(input.locale,30);
  if (!validUrl(pageUrl)||!validUrl(sourceUrl)||issue.length<20||reason.length<20) return json({ message:"Complete all required fields with valid URLs." },400);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ message:"The email address is not valid." },400);
  if (!env.QAZAQ_LENS_DB) return json({ message:"The correction database is not connected yet." },503);

  const id=crypto.randomUUID();
  try {
    await env.QAZAQ_LENS_DB.prepare(`INSERT INTO correction_reports
      (id,created_at,page_url,page_title,issue,reason,source_url,source_title,suggestion,reporter_name,reporter_email,may_credit,locale,status)
      VALUES (?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,'new')`)
      .bind(id,pageUrl,pageTitle||null,issue,reason,sourceUrl,sourceTitle||null,suggestion||null,name||null,email||null,input.mayCredit?1:0,locale||null).run();
    return json({ ok:true,id },201);
  } catch (error) { console.error("Correction submission failed",error); return json({ message:"The report could not be stored. Please try again later." },500); }
};
export const onRequest: PagesFunction<Env> = async (context) => context.request.method === "POST" ? onRequestPost(context) : json({ message:"Method not allowed." },405,{ Allow:"POST" });
