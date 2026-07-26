# Ask Qazaq Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, privacy-conscious claim lookup that returns explainable matches from the published evidence registry and lets readers submit unmatched claims for moderation.

**Architecture:** MDX remains the editorial source of truth. A typed build-time registry converts every visible explainer into a compact search record; a pure matcher runs locally in the browser and never invents a verdict. Only an explicit unmatched-claim submission reaches a same-origin Worker endpoint and D1 moderation queue.

**Tech Stack:** Astro 7, TypeScript 6, MDX content collections, Vitest, Cloudflare Workers, D1

---

## File map

- `src/lib/evidence/types.ts` — shared registry and matcher contracts.
- `src/lib/evidence/normalize.ts` — Unicode-safe deterministic text normalization and tokenization.
- `src/lib/evidence/registry.ts` — converts validated Astro content entries into registry records.
- `src/lib/evidence/matcher.ts` — pure ranking, reasons, thresholds and deterministic tie-breaking.
- `src/pages/data/registry.json.ts` — canonical browser-readable registry.
- `src/pages/ask.astro` — progressive-enhancement lookup UI and unmatched-claim form.
- `src/content.config.ts` — validates curated aliases.
- `worker/claim-suggestions.ts` — request validation, storage and moderation handlers.
- `worker/index.ts` — route dispatch only.
- `migrations/0004_claim_suggestions.sql` — moderated intake schema.
- `src/pages/moderate-claims.astro` — private token-based moderation workspace.
- `tests/evidence/*.test.ts` and `tests/worker/claim-suggestions.test.ts` — behavior tests.

### Task 1: Add a unit-test gate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Add Vitest and scripts**

Run:

```bash
npm install --save-dev vitest@^3.2.4
```

Add these scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"qa": "npm run test && npm run check && npm run audit:function && npm run audit:content && npm run audit:images && npm run build && node scripts/audit-build.mjs"
```

- [ ] **Step 2: Add the deterministic test configuration**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
```

```ts
// tests/smoke.test.ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs TypeScript tests", () => {
    expect(33).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the gate**

Run: `npm test`

Expected: one passing test and exit code 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke.test.ts
git commit -m "test: add deterministic unit test gate"
```

### Task 2: Define the evidence registry contract

**Files:**
- Create: `src/lib/evidence/types.ts`
- Modify: `src/content.config.ts`
- Modify: `src/data/myths/*.mdx`
- Test: `tests/evidence/registry-schema.test.ts`

- [ ] **Step 1: Write the schema test**

```ts
import { describe, expect, it } from "vitest";
import type { EvidenceRegistryRecord } from "../../src/lib/evidence/types";

describe("EvidenceRegistryRecord", () => {
  it("represents searchable editorial data without article body HTML", () => {
    const record: EvidenceRegistryRecord = {
      slug: "part-of-russia",
      title: "Kazakhstan Is Not Part of Russia",
      mythStatement: "Kazakhstan is a region of Russia",
      summary: "Kazakhstan is a sovereign state.",
      verdict: "false",
      publicationStatus: "beta",
      lastReviewedAt: "2026-07-20",
      canonicalUrl: "https://qazaqlens.org/myths/part-of-russia/",
      topics: ["Geography"],
      aliases: ["is kazakhstan russian"],
      claims: [{ id: "C1", statement: "Kazakhstan is a sovereign state.", significance: "critical", confidence: "high" }],
      sourceCount: 4,
    };
    expect(record.claims[0].id).toBe("C1");
    expect(record).not.toHaveProperty("body");
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing module**

Run: `npx vitest run tests/evidence/registry-schema.test.ts`

Expected: FAIL because `src/lib/evidence/types.ts` does not exist.

- [ ] **Step 3: Create the shared types**

```ts
export type Verdict = "false" | "misleading" | "partly-true" | "outdated" | "unverified" | "disputed";
export type PublicationStatus = "beta" | "reviewed";

export interface RegistryClaim {
  id: string;
  statement: string;
  significance: "critical" | "supporting";
  confidence: "high" | "medium" | "low";
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
```

- [ ] **Step 4: Add curated aliases to the content schema**

Add under `topics` in `src/content.config.ts`:

```ts
aliases: z.array(z.string().min(3).max(120)).max(12).default([]),
```

Add these initial curated phrasings to the matching MDX frontmatter:

| Slug | Initial aliases |
|---|---|
| `ai-accuracy-kazakhstan` | “does AI know Kazakhstan”; “AI facts about Kazakhstan” |
| `almaty-earthquake` | “is Almaty always having earthquakes”; “Almaty earthquake danger” |
| `apple-origins` | “did apples come from Kazakhstan”; “origin of apples” |
| `aral-sea-gone` | “is the Aral Sea completely gone”; “Aral Sea disappeared” |
| `baikonur` | “is Baikonur Russian”; “where is Baikonur” |
| `borat` | “is Borat accurate”; “does Borat show real Kazakhstan” |
| `bride-kidnapping` | “is bride kidnapping normal in Kazakhstan”; “Kazakhstan marriage kidnapping” |
| `capital-astana` | “what is the capital of Kazakhstan”; “is Almaty the capital” |
| `charyn-canyon` | “is Charyn a copy of Grand Canyon”; “Kazakhstan Grand Canyon” |
| `country-size` | “is Kazakhstan a small country”; “how big is Kazakhstan” |
| `economy-oil` | “does Kazakhstan only have oil”; “Kazakhstan oil economy” |
| `ethnic-diversity` | “is everyone in Kazakhstan ethnically Kazakh”; “Kazakhstan ethnic groups” |
| `europe-or-asia` | “is Kazakhstan in Europe”; “is Kazakhstan in Asia” |
| `giant-door` | “giant door in Kazakhstan”; “Kazakhstan ancient giant doorway” |
| `horse-domestication` | “were horses domesticated in Kazakhstan”; “Botai horse domestication” |
| `horse-meat-kumys` | “does everyone eat horse meat in Kazakhstan”; “Kazakhstan kumys stereotype” |
| `internet-closed` | “does Kazakhstan have internet”; “is Kazakhstan internet blocked” |
| `kazakh-and-russian` | “is Kazakh a Russian language”; “are Kazakh and Russian related” |
| `kazakh-statehood` | “did Kazakhstan exist before the USSR”; “history of Kazakh statehood” |
| `kazakhstan-memes` | “Kazakhstan memes are real”; “do memes represent Kazakhstan” |
| `landlocked-isolated` | “is Kazakhstan isolated”; “landlocked Kazakhstan trade” |
| `latin-alphabet` | “does Kazakh use Cyrillic”; “Kazakhstan Latin alphabet” |
| `not-middle-east` | “is Kazakhstan in the Middle East”; “Kazakhstan Middle Eastern country” |
| `nuclear-energy-weapons` | “does nuclear power mean nuclear weapons”; “Kazakhstan nuclear power weapons” |
| `nuclear-weapons` | “does Kazakhstan have nuclear weapons”; “Kazakhstan nuclear arsenal” |
| `only-steppe` | “is Kazakhstan all steppe”; “Kazakhstan has only desert” |
| `part-of-russia` | “is Kazakhstan part of Russia”; “Kazakhstan Russian region” |
| `safety-tourism` | “is Kazakhstan safe to visit”; “Kazakhstan tourist safety” |
| `secular-muslim` | “is Kazakhstan an Islamic state”; “is Kazakhstan secular” |
| `semipalatinsk-safe` | “is Semipalatinsk safe now”; “Kazakhstan nuclear test site radiation” |
| `silk-roads` | “was Kazakhstan on the Silk Road”; “Kazakhstan Silk Road history” |
| `tomyris` | “was Tomyris Kazakh”; “Tomyris Kazakhstan history” |
| `yurts` | “does everyone in Kazakhstan live in yurts”; “Kazakhstan yurt stereotype” |

Every alias must express the same topic as its article; do not add broad country keywords merely to increase matches.

- [ ] **Step 5: Validate all content and tests**

Run: `npm run check && npx vitest run tests/evidence/registry-schema.test.ts`

Expected: Astro content validation passes for all explainers; registry type test passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evidence/types.ts src/content.config.ts src/data/myths tests/evidence/registry-schema.test.ts
git commit -m "feat: define curated evidence registry fields"
```

### Task 3: Build the normalized registry

**Files:**
- Create: `src/lib/evidence/registry.ts`
- Create: `src/pages/data/registry.json.ts`
- Test: `tests/evidence/registry.test.ts`
- Delete: `public/data/export.json`

- [ ] **Step 1: Write the pure projection test**

```ts
import { describe, expect, it } from "vitest";
import { toRegistryRecord } from "../../src/lib/evidence/registry";

describe("toRegistryRecord", () => {
  it("preserves editorial fields and emits a canonical URL", () => {
    const record = toRegistryRecord({
      slug: "borat",
      title: "Borat Is Fiction",
      mythStatement: "Borat shows the real Kazakhstan",
      summary: "A fictional satire is not a documentary.",
      verdict: "misleading",
      publicationStatus: "beta",
      lastReviewedAt: new Date("2026-07-20T00:00:00Z"),
      topics: ["Media"],
      aliases: ["is Borat accurate"],
      claims: [{ id: "C1", statement: "The film was not shot as a documentary.", significance: "critical", confidence: "high" }],
      sources: [{ id: "S1" }, { id: "S2" }],
    });
    expect(record.canonicalUrl).toBe("https://qazaqlens.org/myths/borat/");
    expect(record.lastReviewedAt).toBe("2026-07-20");
    expect(record.sourceCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run tests/evidence/registry.test.ts`

Expected: FAIL because `toRegistryRecord` is missing.

- [ ] **Step 3: Implement projection and collection loading**

```ts
import type { MythEntry } from "../content";
import { getVisibleMyths } from "../content";
import type { EvidenceRegistryRecord } from "./types";

type RegistryInput = Pick<MythEntry["data"], "slug" | "title" | "mythStatement" | "summary" | "verdict" | "publicationStatus" | "lastReviewedAt" | "topics" | "aliases" | "claims" | "sources">;

export function toRegistryRecord(data: RegistryInput): EvidenceRegistryRecord {
  return {
    slug: data.slug,
    title: data.title,
    mythStatement: data.mythStatement,
    summary: data.summary,
    verdict: data.verdict,
    publicationStatus: data.publicationStatus,
    lastReviewedAt: data.lastReviewedAt.toISOString().slice(0, 10),
    canonicalUrl: `https://qazaqlens.org/myths/${data.slug}/`,
    topics: [...data.topics],
    aliases: [...data.aliases],
    claims: data.claims.map(({ id, statement, significance, confidence }) => ({ id, statement, significance, confidence })),
    sourceCount: data.sources.length,
  };
}

export async function getEvidenceRegistry() {
  const entries = await getVisibleMyths();
  return entries.map((entry) => toRegistryRecord(entry.data)).sort((a, b) => a.slug.localeCompare(b.slug));
}
```

Create `src/pages/data/registry.json.ts`:

```ts
import { getEvidenceRegistry } from "../../lib/evidence/registry";

export async function GET() {
  const records = await getEvidenceRegistry();
  return new Response(JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), records }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
```

- [ ] **Step 4: Remove the duplicate static export**

Delete `public/data/export.json`. Keep `src/pages/data/export.json.ts` as the canonical generated export so build data cannot become stale or shadow its route.

- [ ] **Step 5: Verify registry and warning cleanup**

Run: `npm test && npm run build`

Expected: tests pass, `/data/registry.json` is generated, and Astro no longer warns that `public/data/export.json` shadows a route.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evidence/registry.ts src/pages/data/registry.json.ts tests/evidence/registry.test.ts public/data/export.json
git commit -m "feat: generate canonical evidence registry"
```

### Task 4: Implement deterministic normalization and matching

**Files:**
- Create: `src/lib/evidence/normalize.ts`
- Create: `src/lib/evidence/matcher.ts`
- Test: `tests/evidence/normalize.test.ts`
- Test: `tests/evidence/matcher.test.ts`

- [ ] **Step 1: Write normalization fixtures**

```ts
import { describe, expect, it } from "vitest";
import { normalizeText, tokenize } from "../../src/lib/evidence/normalize";

describe("normalizeText", () => {
  it.each([
    ["  Is Kazakhstan—part of RUSSIA? ", "is kazakhstan part of russia"],
    ["Qazaqstan’s capital", "qazaqstans capital"],
    ["Казахстан — часть России?", "казахстан часть россии"],
  ])("normalizes %s", (input, expected) => expect(normalizeText(input)).toBe(expected));

  it("drops weak English stop words without dropping meaningful words", () => {
    expect(tokenize("Is Kazakhstan part of Russia?")).toEqual(["kazakhstan", "part", "russia"]);
  });
});
```

- [ ] **Step 2: Write ranking and false-positive fixtures**

```ts
import { describe, expect, it } from "vitest";
import { matchClaim } from "../../src/lib/evidence/matcher";
import type { EvidenceRegistryRecord } from "../../src/lib/evidence/types";

const records: EvidenceRegistryRecord[] = [
  {
    slug: "part-of-russia", title: "Kazakhstan Is Not Part of Russia", mythStatement: "Kazakhstan is a region of Russia",
    summary: "Kazakhstan is sovereign.", verdict: "false", publicationStatus: "beta", lastReviewedAt: "2026-07-20",
    canonicalUrl: "https://qazaqlens.org/myths/part-of-russia/", topics: ["Statehood"], aliases: ["is Kazakhstan Russian"],
    claims: [{ id: "C1", statement: "Kazakhstan is a sovereign UN member state.", significance: "critical", confidence: "high" }], sourceCount: 4,
  },
  {
    slug: "capital-astana", title: "Astana Is the Capital", mythStatement: "Almaty is Kazakhstan's capital",
    summary: "Astana is the capital.", verdict: "outdated", publicationStatus: "beta", lastReviewedAt: "2026-07-20",
    canonicalUrl: "https://qazaqlens.org/myths/capital-astana/", topics: ["Cities"], aliases: ["capital of Kazakhstan"],
    claims: [{ id: "C1", statement: "Astana is the capital city.", significance: "critical", confidence: "high" }], sourceCount: 3,
  },
];

describe("matchClaim", () => {
  it("ranks an exact myth above unrelated records and explains why", () => {
    const [match] = matchClaim("Is Kazakhstan a region of Russia?", records);
    expect(match.record.slug).toBe("part-of-russia");
    expect(match.reasons.some((reason) => reason.field === "myth")).toBe(true);
  });

  it("returns no result for a weak generic query", () => {
    expect(matchClaim("tell me something interesting", records)).toEqual([]);
  });

  it("uses slug order for deterministic equal-score ties", () => {
    const tied = records.map((record) => ({ ...record, aliases: ["same phrase"] }));
    expect(matchClaim("same phrase", tied).map((item) => item.record.slug)).toEqual(["capital-astana", "part-of-russia"]);
  });

  it("does not pretend to read an external URL", () => {
    expect(matchClaim("https://example.com/viral-post", records)).toEqual([]);
  });
});
```

- [ ] **Step 3: Confirm both modules are absent**

Run: `npx vitest run tests/evidence/normalize.test.ts tests/evidence/matcher.test.ts`

Expected: FAIL with missing-module errors.

- [ ] **Step 4: Implement normalization**

```ts
const STOP_WORDS = new Set(["a", "an", "are", "does", "is", "of", "the", "to", "was", "were"]);

export function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u2018\u2019'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

export function tokenize(value: string) {
  return normalizeText(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}
```

- [ ] **Step 5: Implement weighted matching**

```ts
import { normalizeText, tokenize } from "./normalize";
import type { ClaimMatch, EvidenceRegistryRecord, MatchReason } from "./types";

const FIELD_WEIGHT = { myth: 1, title: 0.9, alias: 0.95, claim: 0.82, topic: 0.58, summary: 0.42 } as const;
const MIN_SCORE = 0.46;

const overlap = (query: string[], candidate: string[]) => {
  if (!query.length || !candidate.length) return 0;
  const candidateSet = new Set(candidate);
  return query.filter((token) => candidateSet.has(token)).length / query.length;
};

export function matchClaim(input: string, records: EvidenceRegistryRecord[], limit = 5): ClaimMatch[] {
  const normalized = normalizeText(input);
  const queryTokens = tokenize(input);
  if (normalized.length < 4 || queryTokens.length < 2) return [];

  return records.flatMap((record) => {
    const fields: Array<{ field: MatchReason["field"]; label: string; value: string }> = [
      { field: "myth", label: "Myth statement", value: record.mythStatement },
      { field: "title", label: "Article title", value: record.title },
      ...record.aliases.map((value) => ({ field: "alias" as const, label: "Common wording", value })),
      ...record.claims.map((claim) => ({ field: "claim" as const, label: `Claim ${claim.id}`, value: claim.statement })),
      ...record.topics.map((value) => ({ field: "topic" as const, label: "Topic", value })),
      { field: "summary", label: "Summary", value: record.summary },
    ];
    const scored = fields.map((item) => {
      const exact = normalizeText(item.value) === normalized ? 1 : 0;
      const contains = normalizeText(item.value).includes(normalized) || normalized.includes(normalizeText(item.value)) ? 0.92 : 0;
      const score = Math.max(exact, contains, overlap(queryTokens, tokenize(item.value))) * FIELD_WEIGHT[item.field];
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < MIN_SCORE) return [];
    return [{ record, score: Number(best.score.toFixed(3)), reasons: scored.filter((item) => item.score >= Math.max(MIN_SCORE, best.score - 0.12)).slice(0, 3).map(({ item }) => ({ field: item.field, label: item.label })) }];
  }).sort((a, b) => b.score - a.score || a.record.slug.localeCompare(b.record.slug)).slice(0, limit);
}
```

- [ ] **Step 6: Run matcher tests**

Run: `npx vitest run tests/evidence/normalize.test.ts tests/evidence/matcher.test.ts`

Expected: all fixtures pass, including generic-query rejection and deterministic ties.

- [ ] **Step 7: Commit**

```bash
git add src/lib/evidence/normalize.ts src/lib/evidence/matcher.ts tests/evidence
git commit -m "feat: add explainable deterministic claim matching"
```

### Task 5: Build the Ask interface

**Files:**
- Create: `src/pages/ask.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/styles/global.css`
- Test: `scripts/audit-build.mjs`

- [ ] **Step 1: Add build assertions before the page**

Add to the required-route list in `scripts/audit-build.mjs`:

```js
"ask/index.html",
"data/registry.json",
```

Add content assertions:

```js
assertIncludes("ask/index.html", "Ask Qazaq Lens");
assertIncludes("ask/index.html", "No automatic verdict");
```

- [ ] **Step 2: Run the build audit and confirm failure**

Run: `npm run build && npm run audit:build`

Expected: FAIL because `ask/index.html` does not exist.

- [ ] **Step 3: Create the server-rendered shell and local matcher**

`src/pages/ask.astro` must import `getEvidenceRegistry`, serialize it with `define:vars`, import `matchClaim` in a bundled module script, and render:

```astro
<BaseLayout title="Ask Qazaq Lens" description="Check a claim against the published Qazaq Lens evidence registry.">
  <main class="wrap page-hero ask-page" id="main-content">
    <p class="eyebrow">Claim lookup</p>
    <h1>Ask Qazaq Lens.</h1>
    <p class="lead">Paste a claim or question. Matching happens in your browser; Qazaq Lens does not use AI to invent a verdict.</p>
    <form data-claim-lookup>
      <label for="claim-input">Claim or question</label>
      <textarea id="claim-input" name="claim" minlength="4" maxlength="500" required placeholder="Is Kazakhstan part of Russia?"></textarea>
      <button class="btn btn--primary" type="submit">Check the evidence</button>
    </form>
    <p data-lookup-status role="status" aria-live="polite"></p>
    <section data-lookup-results aria-labelledby="lookup-results-title" hidden>
      <h2 id="lookup-results-title">Closest published evidence</h2>
      <div data-result-list></div>
    </section>
    <section class="card" data-unmatched hidden>
      <h2>No strong match yet</h2>
      <p>This means the current registry is insufficient—not that the claim is true or false.</p>
      <button class="btn" type="button" data-open-suggestion>Suggest this topic</button>
    </section>
  </main>
</BaseLayout>
```

The client renderer must create result elements through `document.createElement` and `textContent`; it must never interpolate user input into `innerHTML`. Each result shows verdict text, summary, last-reviewed date, source count, match reasons and canonical article link.

State rules:

- If the first two results differ by no more than `0.04`, label the group “Several plausible matches” and do not visually promote either result as definitive.
- If input is an external `http:` or `https:` URL, show “This release cannot read external pages. Describe the claim in the page, or submit the URL for editorial review.” Do not fetch it from the browser.
- If input is a canonical Qazaq Lens article URL, match its slug directly to that registry record.
- Inputs below the matcher threshold show the not-found state and no verdict.

- [ ] **Step 4: Add primary navigation and responsive styles**

Add `{ href: "/ask", label: "Ask a claim" }` as the first Evidence menu item in `Header.astro`. Add focused `.ask-page`, `.claim-result`, `.match-reasons` and textarea styles with a one-column layout below 720px, visible focus and 44px minimum controls.

- [ ] **Step 5: Verify build and keyboard behavior**

Run: `npm run qa`

Expected: QA passes; `/ask/` and registry are built.

Manual check:

1. Tab from textarea to submit button.
2. Submit “Is Kazakhstan part of Russia?”
3. Confirm a result and visible match reason.
4. Submit “tell me something interesting.”
5. Confirm the explicit no-match state and no verdict.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ask.astro src/components/Header.astro src/styles/global.css scripts/audit-build.mjs
git commit -m "feat: add local Ask Qazaq Lens lookup"
```

### Task 6: Add moderated unmatched-claim intake

**Files:**
- Create: `migrations/0004_claim_suggestions.sql`
- Create: `worker/claim-suggestions.ts`
- Modify: `worker/index.ts`
- Modify: `src/pages/ask.astro`
- Create: `src/pages/moderate-claims.astro`
- Test: `tests/worker/claim-suggestions.test.ts`

- [ ] **Step 1: Create the D1 schema**

```sql
CREATE TABLE IF NOT EXISTS claim_suggestions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  normalized_hash TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  context TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected', 'resolved'))
);
CREATE INDEX IF NOT EXISTS idx_claim_suggestions_status_created ON claim_suggestions(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_claim_suggestions_hash ON claim_suggestions(normalized_hash);
```

- [ ] **Step 2: Extract Worker helpers for testability**

Move `json`, `clean`, `commentText`, `sameOrigin` and rate-limit helpers from `worker/index.ts` to `worker/http.ts`, export them, and update imports without changing behavior. Run `npm run check`.

Expected: worker typecheck passes before adding the route.

- [ ] **Step 3: Write API validation tests**

Create tests covering:

```ts
it("rejects cross-origin submissions with 403");
it("rejects non-JSON with 415");
it("rejects claims shorter than 12 characters with 400");
it("accepts honeypot submissions without storing them");
it("stores a bounded claim and returns 201");
it("never returns an automatic verdict");
it("requires Bearer auth for moderation");
```

Use a small fake D1 object that records SQL bindings; assert the persisted claim is at most 500 characters and no stored column contains an IP address.

- [ ] **Step 4: Implement suggestion handlers**

Export:

```ts
export async function handleClaimSuggestion(request: Request, env: Env): Promise<Response>
export async function handleClaimSuggestionModeration(request: Request, env: Env): Promise<Response>
```

Rules:

- `POST /api/claim-suggestions`: same-origin, JSON, 8 KB maximum, 2.5-second honeypot timing, 12–500 character claim, optional 500-character context, rate-limit bucket `claim-suggestion`, SHA-256 of normalized text for demand grouping.
- Success body: `{ "ok": true, "status": "new" }`; it contains no verdict.
- `GET/PATCH /api/claim-suggestions/moderate`: Bearer token, list open records, transition to `reviewing`, `accepted`, `rejected` or `resolved`.

Add both routes to `worker/index.ts` and include `DELETE` only if the moderation UI exposes permanent deletion.

- [ ] **Step 5: Connect the form and moderation page**

The Ask form must keep the original local result visible if the API fails. The suggestion form contains claim text, optional context, a hidden honeypot, start timestamp and explicit consent text: “Submitted text enters a private editorial queue.”

Build `moderate-claims.astro` using the same session-only Bearer-token pattern as `moderate.astro`; escape all values before rendering.

- [ ] **Step 6: Update privacy and security documentation**

Add to `src/pages/privacy.astro`:

```text
When you explicitly suggest an unmatched claim, we store the submitted wording, optional context, submission time, moderation status and an irreversible hash used to group duplicates. We do not store your raw IP address; a short-lived HMAC-derived rate-limit key expires within 48 hours.
```

- [ ] **Step 7: Run local gates and apply migration**

Run:

```bash
npm test
npm run qa
npx wrangler d1 migrations apply qazaq-lens-feedback --local
```

Expected: tests and QA pass; migration `0004_claim_suggestions.sql` applies locally.

- [ ] **Step 8: Commit**

```bash
git add migrations/0004_claim_suggestions.sql worker src/pages/ask.astro src/pages/moderate-claims.astro src/pages/privacy.astro tests/worker
git commit -m "feat: add moderated unmatched claim intake"
```

### Task 7: Remove stale generated metadata and close the phase

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `public/llms.txt`
- Delete: `public/robots.txt`
- Modify: `scripts/audit-build.mjs`

- [ ] **Step 1: Replace hard-coded article counts**

In `src/pages/index.astro`, construct FAQ text from `myths.length`. In `public/llms.txt`, remove fixed “31” wording and use “the published evidence library” so the static file cannot drift.

- [ ] **Step 2: Remove the duplicate robots file**

Delete `public/robots.txt`; keep `src/pages/robots.txt.ts` as the only source. Ensure moderation routes are not advertised there.

- [ ] **Step 3: Add consistency assertions**

In `scripts/audit-build.mjs`, parse `/data/registry.json`, `/data/export.json` and `/data/claims.json`; assert equal article-slug sets and assert every registry canonical URL starts with `https://qazaqlens.org/myths/`.

- [ ] **Step 4: Run the complete phase gate**

Run:

```bash
npm run qa
git status --short
```

Expected: QA passes, no duplicate-route warnings, and only intended files are modified.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro public/llms.txt public/robots.txt scripts/audit-build.mjs
git commit -m "fix: keep public evidence metadata synchronized"
```

## Phase release checks

- [ ] Apply remote migration: `npx wrangler d1 migrations apply qazaq-lens-feedback --remote`
- [ ] Deploy: `npx wrangler deploy`
- [ ] Verify: `curl -fsS https://qazaqlens.org/data/registry.json | jq '.records | length'`
- [ ] Verify: `curl -fsS https://qazaqlens.org/ask/ | grep -F "Ask Qazaq Lens"`
- [ ] Submit one test suggestion, confirm it appears in `/moderate-claims/`, then mark it rejected.
- [ ] Verify deployment list: `npx wrangler deployments list`
