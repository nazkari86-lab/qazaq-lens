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
    return (row?.count ?? 0) <= (bucket === "comment" ? 12 : 8);
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
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") { const origin = request.headers.get("origin"); const headers = new Headers({ "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "86400" }); if (origin && ["https://qazaqlens.org", "https://www.qazaqlens.org"].includes(origin)) headers.set("access-control-allow-origin", origin); return new Response(null, { status: 204, headers }); }
      let response: Response;
      if (url.pathname === "/api/report-error") response = await handleCorrection(request, env);
      else if (url.pathname === "/api/comments") response = await handleComments(request, env);
      else if (url.pathname === "/api/comments/moderate") response = await handleCommentModeration(request, env);
      else if (url.pathname === "/api/corrections/moderate") response = await handleCorrectionModeration(request, env);
      else response = json({ message: "Not found." }, 404);
      return corsify(request, response);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
