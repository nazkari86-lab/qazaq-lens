# Impact Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a privacy-preserving accountability dashboard that measures verified editorial outcomes and bounded product use without presenting raw requests as people.

**Architecture:** D1 stores daily aggregates for a strict event allowlist plus editor-verified external citations. The Worker accepts only same-origin, bounded events and never stores raw IPs, referrers or arbitrary metadata. The public dashboard combines those aggregates with build-time evidence counts and displays explicit incomplete-data states.

**Tech Stack:** Cloudflare Workers, D1, Astro, TypeScript, Vitest, existing HMAC rate limiting

---

## File map

- `migrations/0005_impact.sql` — daily counters, verified citations and editorial outcomes.
- `worker/impact.ts` — event validation, aggregation, summary and admin handlers.
- `src/lib/evidence/impact.ts` — public summary types and formatting.
- `src/components/ImpactEvent.astro` — no-cookie first-party event dispatch.
- `src/pages/impact.astro` — public accountability dashboard.
- `src/pages/moderate-impact.astro` — private citation/outcome workspace.
- `tests/worker/impact.test.ts` — privacy, rate-limit and aggregate tests.

### Task 1: Define a bounded impact schema

**Files:**
- Create: `migrations/0005_impact.sql`
- Create: `src/lib/evidence/impact.ts`
- Test: `tests/evidence/impact-types.test.ts`

- [ ] **Step 1: Create tables**

```sql
CREATE TABLE IF NOT EXISTS impact_daily (
  day TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('data_download', 'card_download', 'embed_view', 'ask_match', 'ask_no_match')),
  article_slug TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event_type, article_slug)
);

CREATE TABLE IF NOT EXISTS external_citations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  url TEXT NOT NULL,
  cited_at TEXT,
  article_slug TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'removed'))
);

CREATE TABLE IF NOT EXISTS editorial_outcomes (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('correction_accepted', 'article_updated', 'source_replaced', 'claim_reworded')),
  article_slug TEXT,
  public_note TEXT NOT NULL,
  correction_report_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_impact_daily_type_day ON impact_daily(event_type, day DESC);
CREATE INDEX IF NOT EXISTS idx_external_citations_status ON external_citations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_outcomes_created ON editorial_outcomes(created_at DESC);
```

- [ ] **Step 2: Define public contracts**

```ts
export type ImpactEventType = "data_download" | "card_download" | "embed_view" | "ask_match" | "ask_no_match";

export interface PublicImpactSummary {
  generatedAt: string;
  coverageStartsAt: string | null;
  totals: Record<ImpactEventType, number>;
  corrections: { accepted: number; rejected: number; resolved: number; open: number };
  editorialOutcomes: Array<{ type: string; articleSlug: string | null; note: string; createdAt: string }>;
  externalCitations: Array<{ title: string; publisher: string; url: string; citedAt: string | null; articleSlug: string | null }>;
  requestedTopics: Array<{ articleSlug: string; count: number }>;
  unmatchedDemand: number;
  incomplete: boolean;
}
```

- [ ] **Step 3: Test the allowlist**

Assert the five exact event names compile, and runtime `isImpactEventType("page_view")` returns false.

- [ ] **Step 4: Commit**

```bash
git add migrations/0005_impact.sql src/lib/evidence/impact.ts tests/evidence/impact-types.test.ts
git commit -m "feat: define privacy preserving impact data"
```

### Task 2: Implement aggregate event ingestion

**Files:**
- Create: `worker/impact.ts`
- Modify: `worker/http.ts`
- Modify: `worker/index.ts`
- Test: `tests/worker/impact.test.ts`

- [ ] **Step 1: Write request tests**

Cover:

```ts
it("rejects cross-origin events");
it("rejects event types outside the allowlist");
it("rejects article slugs outside [a-z0-9-]");
it("rejects bodies over 2 KB");
it("increments one daily aggregate row");
it("does not bind raw IP, user agent or referrer");
it("returns 204 on success");
it("returns 429 after the bounded rate limit");
```

The fake D1 recorder must assert every bound string differs from a test IP such as `203.0.113.9`.

- [ ] **Step 2: Implement `handleImpactEvent`**

Rules:

- `POST` only;
- same-origin;
- `application/json`;
- body at most 2,048 characters;
- event allowlist only;
- optional article slug at most 120 characters matching `^[a-z0-9-]+$`;
- bucket `impact`;
- UTC day from Worker time;
- atomic upsert:

```sql
INSERT INTO impact_daily (day,event_type,article_slug,count)
VALUES (?,?,?,1)
ON CONFLICT(day,event_type,article_slug)
DO UPDATE SET count = count + 1
```

Return `204` with no body. Do not read or persist `Referer` or `User-Agent`.

- [ ] **Step 3: Dispatch the endpoint**

Route `/api/impact/event` to `handleImpactEvent`. Extend `enforceRateLimit` with explicit limits:

```ts
const RATE_LIMITS = { comment: 12, correction: 8, "claim-suggestion": 8, impact: 120 } as const;
```

Unknown buckets must default to the most restrictive value, 8.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run tests/worker/impact.test.ts
npm run check
git add worker tests/worker/impact.test.ts
git commit -m "feat: aggregate bounded impact events"
```

### Task 3: Add public summary and admin records

**Files:**
- Modify: `worker/impact.ts`
- Modify: `worker/index.ts`
- Create: `src/pages/moderate-impact.astro`
- Test: `tests/worker/impact-summary.test.ts`

- [ ] **Step 1: Test empty and partial summaries**

Assert:

- no rows yields zero totals, `coverageStartsAt: null`, `incomplete: true`;
- daily rows are summed by event type;
- correction counts come from `correction_reports`;
- only `verified` citations are public;
- reporter names, emails, raw suggestion text and moderator tokens never appear.

- [ ] **Step 2: Implement `GET /api/impact/summary`**

Run fixed SQL queries for:

- event totals;
- first recorded day;
- top matched article slugs;
- total unmatched demand;
- correction status counts;
- public editorial outcomes;
- verified external citations.

Return `cache-control: public, max-age=300`. If one optional query fails because its migration is absent, return zeros for that section and `incomplete: true`; do not fail the whole dashboard.

- [ ] **Step 3: Implement authenticated admin CRUD**

`/api/impact/moderate` requires the existing Bearer token:

- `POST` adds a verified citation or editorial outcome;
- `PATCH` edits a citation or marks it removed;
- `DELETE` permanently removes a mistaken admin record.

Validate citation URLs as HTTP(S), require titles/publishers, bound every string, and reject HTML control characters.

- [ ] **Step 4: Build the private workspace**

`moderate-impact.astro` stores the token only in a JavaScript variable for the current page. It has separate semantic forms for:

- verified external citation;
- public editorial outcome.

All returned values are escaped before display. No form uses GET and no token enters a URL.

- [ ] **Step 5: Run tests and commit**

```bash
npm test
npm run check
git add worker src/pages/moderate-impact.astro tests/worker/impact-summary.test.ts
git commit -m "feat: add verified impact records and summary"
```

### Task 4: Instrument only meaningful actions

**Files:**
- Create: `src/components/ImpactEvent.astro`
- Modify: `src/pages/ask.astro`
- Modify: `src/components/EvidenceCard.astro`
- Modify: `src/pages/sources.astro`
- Modify: `src/pages/cards/[slug].astro`
- Test: `tests/evidence/impact-client.test.ts`

- [ ] **Step 1: Add a tiny sender**

```ts
export function recordImpact(eventType: string, articleSlug = "") {
  const payload = JSON.stringify({ eventType, articleSlug });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/impact/event", new Blob([payload], { type: "application/json" }));
    return;
  }
  void fetch("/api/impact/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "same-origin",
  });
}
```

Do not attach cookies, referrers, screen properties, user agents or arbitrary labels.

- [ ] **Step 2: Emit allowed actions**

- Ask with strong result: `ask_match` once per form submission.
- Ask with no result: `ask_no_match` once per form submission.
- SVG or PNG click: `card_download`.
- Card page loaded in `?embed=1`: `embed_view`.
- Add a visible “Download machine-readable evidence” link to `/data/export.json` on `sources.astro`; its click records `data_download`.

Do not record ordinary page views, scroll depth, service-worker requests or comments.

- [ ] **Step 3: Test duplicate prevention**

Use event-listener fixtures to assert one click emits one event even after Astro navigation or repeated component initialization.

- [ ] **Step 4: Run tests and commit**

```bash
npm test
git add src/components/ImpactEvent.astro src/pages/ask.astro src/components/EvidenceCard.astro src/pages/sources.astro src/pages/cards tests/evidence/impact-client.test.ts
git commit -m "feat: record meaningful first party impact events"
```

### Task 5: Build the public accountability dashboard

**Files:**
- Create: `src/pages/impact.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/styles/global.css`
- Modify: `src/pages/privacy.astro`
- Test: `scripts/audit-build.mjs`

- [ ] **Step 1: Add build assertions**

Require `impact/index.html` and the phrases:

```text
Impact and accountability
Not user counts
Coverage began
```

- [ ] **Step 2: Build the page**

The static shell fetches `/api/impact/summary` on load. Build-time data from `getVisibleMyths` and the health calculator supplies article, claim, source, reviewer, freshness and backlog counts.

Sections:

1. “What exists” — explainers, claims, sources, independent reviewers.
2. “What people used” — data downloads, card downloads, embeds; label as actions, not people.
3. “What readers changed” — accepted/resolved corrections and public editorial outcomes.
4. “Where Qazaq Lens was cited” — editor-verified citations with external links.
5. “What evidence needs work” — freshness and review backlog.
6. “What readers asked for” — existing matched topics and aggregate unmatched demand.
7. Method note — coverage start, exclusions and incomplete-data status.

If the API fails, keep build-time accountability sections visible and show “Live impact aggregates are temporarily unavailable.”

- [ ] **Step 3: Add honest visualizations**

Use semantic HTML bars with exact numbers and accessible labels. Every visual bar must have a visible value; never use a chart whose area implies unique users. Hide sections with zero verified records behind a clear “No verified records published yet” message.

- [ ] **Step 4: Update navigation and privacy**

Add “Impact” to the Evidence navigation. State in Privacy that the site stores daily aggregate action counts from a fixed allowlist, optional article slugs, and short-lived HMAC rate-limit keys; it does not store raw IPs or present these actions as people.

- [ ] **Step 5: Run phase QA**

Run:

```bash
npm test
npm run qa
npx wrangler d1 migrations apply qazaq-lens-feedback --local
```

Expected: all gates pass and migration `0005_impact.sql` applies locally.

- [ ] **Step 6: Commit**

```bash
git add src/pages/impact.astro src/components/Header.astro src/styles/global.css src/pages/privacy.astro scripts/audit-build.mjs
git commit -m "feat: publish impact and accountability dashboard"
```

### Task 6: Production release and verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document operational commands**

Add:

```bash
cd /Users/dulatnurlanuly/Downloads/qazaq-lens
npm ci
npm run qa
npx wrangler d1 migrations apply qazaq-lens-feedback --remote
npx wrangler deploy
npx wrangler deployments list
```

Document `/moderate-impact/` and state that `COMMENTS_ADMIN_TOKEN` remains a Worker secret.

- [ ] **Step 2: Apply remote migrations**

Run: `npx wrangler d1 migrations apply qazaq-lens-feedback --remote`

Expected: migrations through `0005_impact.sql` are applied to the configured D1 database.

- [ ] **Step 3: Deploy and smoke test**

Run:

```bash
npm run qa
npx wrangler deploy
curl -fsS https://qazaqlens.org/impact/ | grep -F "Impact and accountability"
curl -fsS https://qazaqlens.org/api/impact/summary | jq '{coverageStartsAt,totals,incomplete}'
npx wrangler deployments list
```

Expected: page and JSON summary respond from production; deployment list shows the new version.

- [ ] **Step 4: Verify privacy behavior**

Submit one allowed impact event and query D1:

```bash
npx wrangler d1 execute qazaq-lens-feedback --remote --command "SELECT day,event_type,article_slug,count FROM impact_daily ORDER BY day DESC LIMIT 10;"
```

Expected: only day, allowed event type, optional slug and count are stored; no IP, referrer or user-agent columns exist.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: document evidence platform operations"
git push origin main
```

## Phase release checks

- [ ] Confirm raw Cloudflare requests, visits and service-worker hits are absent from the public dashboard.
- [ ] Confirm zero citations render as “No verified records published yet.”
- [ ] Confirm API failure leaves build-time evidence accountability visible.
- [ ] Confirm moderation requires the Bearer token and never places it in URL/history.
- [ ] Confirm production D1 contains aggregate rows only.
