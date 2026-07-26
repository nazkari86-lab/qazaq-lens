interface Env {
  ASSETS: Fetcher;
  QAZAQ_LENS_DB?: D1Database;
  COMMENTS_ADMIN_TOKEN?: string;
  RATE_LIMIT_SECRET?: string;
}

interface CorrectionPayload {
  pageUrl: string;
  pageTitle?: string;
  issue: string;
  reason: string;
  sourceUrl: string;
  sourceTitle?: string;
  suggestion?: string;
  name?: string;
  email?: string;
  mayCredit?: boolean;
  website?: string;
  startedAt?: number;
  locale?: string;
}

interface ClaimSuggestionPayload {
  claim?: string;
  context?: string;
  website?: string;
  startedAt?: number;
  locale?: string;
}

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const commentText = (value: unknown, max: number) => clean(value, max).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLocaleLowerCase("en")));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hashIdentity = async (request: Request, secret: string) => {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const enforceRateLimit = async (request: Request, env: Env, bucket: string) => {
  if (!env.QAZAQ_LENS_DB) return true;
  const windowStart = Math.floor(Date.now() / 3_600_000);
  try {
    const identityHash = await hashIdentity(request, env.RATE_LIMIT_SECRET ?? "qazaq-lens-rate-limit-missing-secret");
    const key = `${bucket}:${identityHash}`;
    await env.QAZAQ_LENS_DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(windowStart - 48).run();
    await env.QAZAQ_LENS_DB.prepare("INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1) ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1").bind(key, windowStart).run();
    const row = await env.QAZAQ_LENS_DB.prepare("SELECT count FROM rate_limits WHERE bucket = ? AND window_start = ?").bind(key, windowStart).first<{ count: number }>();
    const limits: Record<string, number> = { comment: 12, correction: 8, "claim-suggestion": 8, impact: 120 };
    return (row?.count ?? 0) <= (limits[bucket] ?? 8);
  } catch {
    return true;
  }
};

async function handleComments(request: Request, env: Env) {
  if (!env.QAZAQ_LENS_DB) return json({ message: "The comment database is not connected yet." }, 503);
  const url = new URL(request.url);
  const slug = commentText(url.searchParams.get("slug"), 120);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return json({ message: "A valid article slug is required." }, 400);

  if (request.method === "GET") {
    const result = await env.QAZAQ_LENS_DB.prepare(`SELECT id,created_at,page_slug,author_name,body,locale FROM comments WHERE page_slug = ? AND status = 'approved' ORDER BY created_at ASC LIMIT 100`).bind(slug).all();
    return json({ comments: result.results });
  }
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { Allow: "GET, POST" });
  if (!sameOrigin(request)) return json({ message: "Cross-site submissions are not accepted." }, 403);
  if (!(await enforceRateLimit(request, env, "comment"))) return json({ message: "Too many submissions. Please try again later." }, 429, { "retry-after": "3600" });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return json({ message: "Content type must be application/json." }, 415);
  const rawBody = await request.text();
  if (rawBody.length > 8_000) return json({ message: "Comment is too large." }, 413);
  let input: { name?: string; email?: string; body?: string; website?: string; startedAt?: number; locale?: string };
  try { input = JSON.parse(rawBody); } catch { return json({ message: "Invalid JSON request." }, 400); }
  if (commentText(input.website, 100)) return json({ ok: true, status: "pending" }, 201);
  const elapsed = Date.now() - Number(input.startedAt ?? 0);
  const name = commentText(input.name, 80);
  const email = commentText(input.email, 200);
  const body = commentText(input.body, 2000);
  if (!Number.isFinite(elapsed) || elapsed < 1800 || elapsed > 86_400_000) return json({ message: "Please take a moment to review your comment and try again." }, 400);
  if (name.length < 2 || body.length < 10) return json({ message: "Please provide a name and a comment of at least 10 characters." }, 400);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ message: "The email address is not valid." }, 400);
  const id = crypto.randomUUID();
  await env.QAZAQ_LENS_DB.prepare(`INSERT INTO comments (id,created_at,updated_at,page_url,page_slug,author_name,author_email,body,locale,status) VALUES (?,datetime('now'),datetime('now'),?,?,?,?,?,?,'pending')`).bind(id, new URL(request.url).origin + `/myths/${slug}/`, slug, name, email || null, body, commentText(input.locale, 30) || null).run();
  return json({ ok: true, id, status: "pending" }, 201);
}

async function handleCommentModeration(request: Request, env: Env) {
  if (!env.QAZAQ_LENS_DB || !env.COMMENTS_ADMIN_TOKEN) return json({ message: "Moderation is not configured." }, 503);
  if (request.headers.get("authorization") !== `Bearer ${env.COMMENTS_ADMIN_TOKEN}`) return json({ message: "Unauthorized." }, 401);
  if (request.method === "GET") {
    const result = await env.QAZAQ_LENS_DB.prepare(`SELECT id,created_at,page_slug,author_name,author_email,body,locale,status,moderator_note FROM comments WHERE status IN ('pending','approved') ORDER BY created_at ASC LIMIT 200`).all();
    return json({ comments: result.results });
  }
  if (request.method === "DELETE") {
    let input: { id?: string };
    try { input = await request.json(); } catch { return json({ message: "Invalid deletion request." }, 400); }
    const id = commentText(input.id, 80);
    if (!id) return json({ message: "A comment id is required." }, 400);
    const result = await env.QAZAQ_LENS_DB.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
    return json({ ok: true, id, deleted: (result.meta?.changes ?? 0) > 0 });
  }
  if (request.method !== "PATCH") return json({ message: "Method not allowed." }, 405, { Allow: "GET, PATCH" });
  let input: { id?: string; status?: string; note?: string };
  try { input = await request.json(); } catch { return json({ message: "Invalid JSON request." }, 400); }
  const id = commentText(input.id, 80);
  const status = input.status;
  if (!id || !["approved", "rejected", "hidden"].includes(status ?? "")) return json({ message: "Invalid moderation update." }, 400);
  await env.QAZAQ_LENS_DB.prepare(`UPDATE comments SET status = ?, moderator_note = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, commentText(input.note, 500) || null, id).run();
  return json({ ok: true, id, status });
}

async function handleCorrectionModeration(request: Request, env: Env) {
  if (!env.QAZAQ_LENS_DB || !env.COMMENTS_ADMIN_TOKEN) return json({ message: "Moderation is not configured." }, 503);
  if (request.headers.get("authorization") !== `Bearer ${env.COMMENTS_ADMIN_TOKEN}`) return json({ message: "Unauthorized." }, 401);
  if (request.method === "GET") {
    const result = await env.QAZAQ_LENS_DB.prepare(`SELECT id,created_at,page_url,page_title,issue,reason,source_url,source_title,suggestion,reporter_name,reporter_email,may_credit,locale,status FROM correction_reports WHERE status IN ('new','reviewing') ORDER BY created_at ASC LIMIT 200`).all();
    return json({ reports: result.results });
  }
  if (request.method !== "PATCH") return json({ message: "Method not allowed." }, 405, { Allow: "GET, PATCH" });
  let input: { id?: string; status?: string; note?: string };
  try { input = await request.json(); } catch { return json({ message: "Invalid JSON request." }, 400); }
  const id = commentText(input.id, 80);
  const status = input.status;
  if (!id || !["reviewing", "accepted", "rejected", "resolved"].includes(status ?? "")) return json({ message: "Invalid correction update." }, 400);
  await env.QAZAQ_LENS_DB.prepare(`UPDATE correction_reports SET status = ? WHERE id = ?`).bind(status, id).run();
  return json({ ok: true, id, status });
}

async function handleClaimSuggestion(request: Request, env: Env) {
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { Allow: "POST" });
  if (!sameOrigin(request)) return json({ message: "Cross-site submissions are not accepted." }, 403);
  if (!env.QAZAQ_LENS_DB) return json({ message: "The suggestion database is not connected yet." }, 503);
  if (!(await enforceRateLimit(request, env, "claim-suggestion"))) return json({ message: "Too many submissions. Please try again later." }, 429, { "retry-after": "3600" });
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ message: "Content type must be application/json." }, 415);
  const rawBody = await request.text();
  if (rawBody.length > 8_000) return json({ message: "Suggestion is too large." }, 413);
  let input: ClaimSuggestionPayload;
  try { input = JSON.parse(rawBody) as ClaimSuggestionPayload; } catch { return json({ message: "Invalid JSON request." }, 400); }
  if (commentText(input.website, 100)) return json({ ok: true, status: "new" }, 201);
  const elapsed = Date.now() - Number(input.startedAt ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < 2500 || elapsed > 86_400_000) return json({ message: "Please take a moment to review the suggestion and try again." }, 400);
  const claim = commentText(input.claim, 500);
  const context = commentText(input.context, 500);
  if (claim.length < 12) return json({ message: "Please describe a claim using at least 12 characters." }, 400);
  try {
    const id = crypto.randomUUID();
    await env.QAZAQ_LENS_DB.prepare("INSERT INTO claim_suggestions (id,created_at,updated_at,normalized_hash,claim_text,context,locale,status) VALUES (?,datetime('now'),datetime('now'),?,?,?,?,'new')")
      .bind(id, await hashText(claim), claim, context || null, commentText(input.locale, 30) || null).run();
    return json({ ok: true, status: "new" }, 201);
  } catch (error) {
    console.error("Claim suggestion submission failed", error);
    return json({ message: "The suggestion could not be stored. Please try again later." }, 500);
  }
}

async function handleClaimSuggestionModeration(request: Request, env: Env) {
  if (!env.QAZAQ_LENS_DB || !env.COMMENTS_ADMIN_TOKEN) return json({ message: "Moderation is not configured." }, 503);
  if (request.headers.get("authorization") !== `Bearer ${env.COMMENTS_ADMIN_TOKEN}`) return json({ message: "Unauthorized." }, 401);
  if (request.method === "GET") {
    const result = await env.QAZAQ_LENS_DB.prepare("SELECT id,created_at,claim_text,context,locale,status FROM claim_suggestions WHERE status IN ('new','reviewing') ORDER BY created_at ASC LIMIT 200").all();
    return json({ suggestions: result.results });
  }
  if (request.method !== "PATCH") return json({ message: "Method not allowed." }, 405, { Allow: "GET, PATCH" });
  let input: { id?: string; status?: string };
  try { input = await request.json(); } catch { return json({ message: "Invalid JSON request." }, 400); }
  const id = commentText(input.id, 80);
  if (!id || !["reviewing", "accepted", "rejected", "resolved"].includes(input.status ?? "")) return json({ message: "Invalid moderation update." }, 400);
  await env.QAZAQ_LENS_DB.prepare("UPDATE claim_suggestions SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(input.status, id).run();
  return json({ ok: true, id, status: input.status });
}

const IMPACT_EVENTS = new Set(["data_download", "card_download", "embed_view", "ask_match", "ask_no_match"]);

async function handleImpactEvent(request: Request, env: Env) {
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { Allow: "POST" });
  if (!sameOrigin(request)) return json({ message: "Cross-site submissions are not accepted." }, 403);
  if (!env.QAZAQ_LENS_DB) return json({ message: "Impact storage is not connected yet." }, 503);
  if (!(await enforceRateLimit(request, env, "impact"))) return json({ message: "Too many requests. Please try again later." }, 429, { "retry-after": "3600" });
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ message: "Content type must be application/json." }, 415);
  const rawBody = await request.text();
  if (rawBody.length > 2_048) return json({ message: "Event body is too large." }, 413);
  let input: { eventType?: string; articleSlug?: string };
  try { input = JSON.parse(rawBody); } catch { return json({ message: "Invalid JSON request." }, 400); }
  const eventType = clean(input.eventType, 40);
  const articleSlug = clean(input.articleSlug, 120);
  if (!IMPACT_EVENTS.has(eventType) || (articleSlug && !/^[a-z0-9-]+$/.test(articleSlug))) return json({ message: "Invalid impact event." }, 400);
  await env.QAZAQ_LENS_DB.prepare("INSERT INTO impact_daily (day,event_type,article_slug,count) VALUES (date('now'),?,?,1) ON CONFLICT(day,event_type,article_slug) DO UPDATE SET count = count + 1").bind(eventType, articleSlug).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function handleImpactSummary(request: Request, env: Env) {
  if (request.method !== "GET") return json({ message: "Method not allowed." }, 405, { Allow: "GET" });
  if (!env.QAZAQ_LENS_DB) return json({ message: "Impact storage is not connected yet." }, 503);
  try {
    const [events, coverage, corrections, citations, outcomes, topics, unmatched] = await Promise.all([
      env.QAZAQ_LENS_DB.prepare("SELECT event_type, SUM(count) AS count FROM impact_daily GROUP BY event_type").all<{ event_type: string; count: number }>(),
      env.QAZAQ_LENS_DB.prepare("SELECT MIN(day) AS day FROM impact_daily").first<{ day: string | null }>(),
      env.QAZAQ_LENS_DB.prepare("SELECT status, COUNT(*) AS count FROM correction_reports GROUP BY status").all<{ status: string; count: number }>(),
      env.QAZAQ_LENS_DB.prepare("SELECT title,publisher,url,cited_at,article_slug FROM external_citations WHERE status = 'verified' ORDER BY created_at DESC LIMIT 12").all(),
      env.QAZAQ_LENS_DB.prepare("SELECT outcome_type,article_slug,public_note,created_at FROM editorial_outcomes ORDER BY created_at DESC LIMIT 12").all(),
      env.QAZAQ_LENS_DB.prepare("SELECT article_slug, SUM(count) AS count FROM impact_daily WHERE event_type = 'ask_match' AND article_slug != '' GROUP BY article_slug ORDER BY count DESC LIMIT 8").all(),
      env.QAZAQ_LENS_DB.prepare("SELECT SUM(count) AS count FROM impact_daily WHERE event_type = 'ask_no_match'").first<{ count: number | null }>(),
    ]);
    const totals: Record<string, number> = { data_download: 0, card_download: 0, embed_view: 0, ask_match: 0, ask_no_match: 0 };
    (events.results ?? []).forEach((row) => { totals[row.event_type] = Number(row.count) || 0; });
    const correctionTotals: Record<string, number> = { accepted: 0, rejected: 0, resolved: 0, open: 0 };
    (corrections.results ?? []).forEach((row) => { if (row.status === "new" || row.status === "reviewing") correctionTotals.open += Number(row.count) || 0; else if (row.status in correctionTotals) correctionTotals[row.status] += Number(row.count) || 0; });
    return json({ generatedAt: new Date().toISOString(), coverageStartsAt: coverage?.day ?? null, totals, corrections: correctionTotals, externalCitations: citations.results ?? [], editorialOutcomes: outcomes.results ?? [], requestedTopics: topics.results ?? [], unmatchedDemand: Number(unmatched?.count) || 0, incomplete: false }, 200, { "cache-control": "public, max-age=300" });
  } catch (error) {
    console.error("Impact summary failed", error);
    return json({ message: "Impact aggregates are not available yet.", incomplete: true }, 503);
  }
}

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return [new URL(request.url).host, "qazaqlens.org", "www.qazaqlens.org"].includes(new URL(origin).host);
  } catch {
    return false;
  }
};

const corsify = (request: Request, response: Response) => {
  const origin = request.headers.get("origin");
  if (!origin || !["https://qazaqlens.org", "https://www.qazaqlens.org"].includes(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
};

const serveAsset = async (request: Request, env: Env, pathname: string) => {
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  if (pathname === "/data/registry.json") headers.set("cache-control", "public, max-age=3600");
  if (pathname.startsWith("/cards/")) {
    headers.delete("x-frame-options");
    headers.set("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors https:; base-uri 'self'; form-action 'self'");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

async function handleCorrection(request: Request, env: Env) {
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { Allow: "POST" });
  if (!sameOrigin(request)) return json({ message: "Cross-site submissions are not accepted." }, 403);
  if (!(await enforceRateLimit(request, env, "correction"))) return json({ message: "Too many submissions. Please try again later." }, 429, { "retry-after": "3600" });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return json({ message: "Content type must be application/json." }, 415);

  const rawBody = await request.text();
  if (rawBody.length > 32_000) return json({ message: "Submission is too large." }, 413);
  let input: CorrectionPayload;
  try {
    input = JSON.parse(rawBody) as CorrectionPayload;
  } catch {
    return json({ message: "Invalid JSON request." }, 400);
  }

  if (clean(input.website, 200)) return json({ ok: true, id: "accepted" });

  const elapsed = Date.now() - Number(input.startedAt ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < 2500 || elapsed > 86_400_000) {
    return json({ message: "Please reload the form and try again." }, 400);
  }

  const pageUrl = clean(input.pageUrl, 500);
  const pageTitle = clean(input.pageTitle, 250);
  const issue = clean(input.issue, 2000);
  const reason = clean(input.reason, 3000);
  const sourceUrl = clean(input.sourceUrl, 500);
  const sourceTitle = clean(input.sourceTitle, 250);
  const suggestion = clean(input.suggestion, 3000);
  const name = clean(input.name, 120);
  const email = clean(input.email, 200);
  const locale = clean(input.locale, 30);

  if (!validUrl(pageUrl) || !validUrl(sourceUrl) || issue.length < 20 || reason.length < 20) {
    return json({ message: "Complete all required fields with valid URLs." }, 400);
  }
  const normalizedSourceUrl = new URL(sourceUrl).toString();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ message: "The email address is not valid." }, 400);
  if (!env.QAZAQ_LENS_DB) return json({ message: "The correction database is not connected yet." }, 503);

  const id = crypto.randomUUID();
  try {
    await env.QAZAQ_LENS_DB.prepare(`INSERT INTO correction_reports
      (id,created_at,page_url,page_title,issue,reason,source_url,source_title,suggestion,reporter_name,reporter_email,may_credit,locale,status)
      VALUES (?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,'new')`)
      .bind(
        id,
        pageUrl,
        pageTitle || null,
        issue,
        reason,
        normalizedSourceUrl,
        sourceTitle || null,
        suggestion || null,
        name || null,
        email || null,
        input.mayCredit ? 1 : 0,
        locale || null,
      )
      .run();
    return json({ ok: true, id }, 201);
  } catch (error) {
    console.error("Correction submission failed", error);
    return json({ message: "The report could not be stored. Please try again later." }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "qazaq-lens.nazkari86.workers.dev" && (request.method === "GET" || request.method === "HEAD")) {
      const destination = new URL(url.pathname + url.search, "https://qazaqlens.org");
      return Response.redirect(destination.toString(), 308);
    }
    if (url.pathname === "/.well-known/security.txt" && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(
        "Contact: mailto:nazkari86@gmail.com\nPreferred-Languages: en, ru\nPolicy: https://qazaqlens.org/about/\nCanonical: https://qazaqlens.org/.well-known/security.txt\nExpires: 2027-07-23T00:00:00.000Z\n",
        { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } },
      );
    }
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") { const origin = request.headers.get("origin"); const headers = new Headers({ "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "86400" }); if (origin && ["https://qazaqlens.org", "https://www.qazaqlens.org"].includes(origin)) headers.set("access-control-allow-origin", origin); return new Response(null, { status: 204, headers }); }
      let response: Response;
      if (url.pathname === "/api/report-error") response = await handleCorrection(request, env);
      else if (url.pathname === "/api/comments") response = await handleComments(request, env);
      else if (url.pathname === "/api/comments/moderate") response = await handleCommentModeration(request, env);
      else if (url.pathname === "/api/corrections/moderate") response = await handleCorrectionModeration(request, env);
      else if (url.pathname === "/api/claim-suggestions") response = await handleClaimSuggestion(request, env);
      else if (url.pathname === "/api/claim-suggestions/moderate") response = await handleClaimSuggestionModeration(request, env);
      else if (url.pathname === "/api/impact/event") response = await handleImpactEvent(request, env);
      else if (url.pathname === "/api/impact/summary") response = await handleImpactSummary(request, env);
      else response = json({ message: "Not found." }, 404);
      return corsify(request, response);
    }
    return serveAsset(request, env, url.pathname);
  },
} satisfies ExportedHandler<Env>;
