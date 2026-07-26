# Evidence Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synthetic evidence score with concrete, explainable health signals for every explainer and for the full library.

**Architecture:** A pure calculator consumes validated article metadata and optional link-audit results, returning named signals and warnings rather than a single trust score. Article, data-status and source-dashboard views share the same output model, so freshness and review labels cannot drift.

**Tech Stack:** Astro 7, TypeScript, Vitest, MDX content collections, existing link-audit scripts

---

## File map

- `src/lib/evidence/health.ts` — signal rules and warning generation.
- `src/lib/evidence/types.ts` — health contracts shared by UI and generated data.
- `src/content.config.ts` — topic time-sensitivity and source independence metadata.
- `src/components/EvidenceHealth.astro` — article-level progressive disclosure.
- `src/pages/data-status.astro` — library review queue.
- `src/pages/sources.astro` — aggregate evidence dashboard.
- `scripts/check-external-links.mjs` — writes bounded audit results.
- `public/data/link-health.json` — generated link status input.
- `tests/evidence/health.test.ts` — historical/current/failure fixtures.

### Task 1: Add explicit editorial cadence metadata

**Files:**
- Modify: `src/content.config.ts`
- Modify: `src/data/myths/*.mdx`
- Test: `tests/evidence/health-schema.test.ts`

- [ ] **Step 1: Write the metadata contract test**

```ts
import { describe, expect, it } from "vitest";
import type { EvidenceCadence } from "../../src/lib/evidence/types";

describe("EvidenceCadence", () => {
  it.each(["historical", "slow", "current"] satisfies EvidenceCadence[])("accepts %s", (value) => {
    expect(value).toMatch(/^(historical|slow|current)$/);
  });
});
```

- [ ] **Step 2: Add the type and schema**

Add to `src/lib/evidence/types.ts`:

```ts
export type EvidenceCadence = "historical" | "slow" | "current";
```

Add to the myth schema:

```ts
evidenceCadence: z.enum(["historical", "slow", "current"]),
```

Strengthen `independenceGroup`:

```ts
independenceGroup: z.string().min(2).max(100).optional(),
```

- [ ] **Step 3: Classify all published explainers**

Add exactly one `evidenceCadence` to every MDX file using this reviewed mapping:

| Cadence | Slugs |
|---|---|
| `historical` | `apple-origins`, `horse-domestication`, `kazakh-statehood`, `silk-roads`, `tomyris` |
| `current` | `ai-accuracy-kazakhstan`, `almaty-earthquake`, `aral-sea-gone`, `bride-kidnapping`, `capital-astana`, `economy-oil`, `internet-closed`, `latin-alphabet`, `safety-tourism`, `semipalatinsk-safe` |
| `slow` | `baikonur`, `borat`, `charyn-canyon`, `country-size`, `ethnic-diversity`, `europe-or-asia`, `giant-door`, `horse-meat-kumys`, `kazakh-and-russian`, `kazakhstan-memes`, `landlocked-isolated`, `not-middle-east`, `nuclear-energy-weapons`, `nuclear-weapons`, `only-steppe`, `part-of-russia`, `secular-muslim`, `yurts` |

Add `independenceGroup` where two publisher names rely on the same underlying dataset or institution. Use stable labels such as `kazakhstan-bns-population`, `un-member-state-record`, or `world-bank-wdi`; do not use source type as the group.

- [ ] **Step 4: Validate**

Run: `npm run check && npx vitest run tests/evidence/health-schema.test.ts`

Expected: all 33 explainers satisfy cadence metadata; test passes.

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts src/lib/evidence/types.ts src/data/myths tests/evidence/health-schema.test.ts
git commit -m "feat: classify evidence review cadence"
```

### Task 2: Implement concrete health signals

**Files:**
- Create: `src/lib/evidence/health.ts`
- Modify: `src/lib/evidence/types.ts`
- Test: `tests/evidence/health.test.ts`

- [ ] **Step 1: Define failing fixtures**

```ts
import { describe, expect, it } from "vitest";
import { calculateEvidenceHealth } from "../../src/lib/evidence/health";

const source = (overrides = {}) => ({
  id: "S1", title: "Dataset", publisher: "Publisher A", accessedAt: new Date("2026-07-01"),
  publishedAt: "2026-06-01", url: "https://example.com/a", language: "English", type: "official",
  ...overrides,
});

describe("calculateEvidenceHealth", () => {
  it("warns sooner for current evidence", () => {
    const health = calculateEvidenceHealth({
      lastReviewedAt: new Date("2025-12-01"), evidenceCadence: "current", publicationStatus: "beta",
      reviewedBy: [], sources: [source(), source({ id: "S2", publisher: "Publisher B", url: "https://example.org/b" })],
      claims: [{ id: "C1", significance: "critical", confidence: "high", sourceIds: ["S1", "S2"] }],
    }, new Date("2026-07-26"));
    expect(health.review.state).toBe("overdue");
    expect(health.warnings.map((item) => item.code)).toContain("review-overdue");
  });

  it("does not call an old historical source stale merely because it is old", () => {
    const health = calculateEvidenceHealth({
      lastReviewedAt: new Date("2026-07-01"), evidenceCadence: "historical", publicationStatus: "beta",
      reviewedBy: [], sources: [source({ publishedAt: "1991-12-16" }), source({ id: "S2", publisher: "Archive B", url: "https://example.org/b", publishedAt: "1992-03-02" })],
      claims: [{ id: "C1", significance: "critical", confidence: "high", sourceIds: ["S1", "S2"] }],
    }, new Date("2026-07-26"));
    expect(health.sourceFreshness.stale).toBe(0);
  });

  it("reports publisher and independence-group diversity separately", () => {
    const health = calculateEvidenceHealth({
      lastReviewedAt: new Date("2026-07-01"), evidenceCadence: "slow", publicationStatus: "beta",
      reviewedBy: [], sources: [source({ independenceGroup: "dataset-a" }), source({ id: "S2", publisher: "Publisher B", url: "https://example.org/b", independenceGroup: "dataset-a" })],
      claims: [{ id: "C1", significance: "critical", confidence: "high", sourceIds: ["S1", "S2"] }],
    }, new Date("2026-07-26"));
    expect(health.diversity.publishers).toBe(2);
    expect(health.diversity.independenceGroups).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/evidence/health.test.ts`

Expected: FAIL because the calculator does not exist.

- [ ] **Step 3: Add the health model**

```ts
export interface EvidenceWarning {
  code: "review-overdue" | "critical-low-confidence" | "single-independence-group" | "missing-published-date" | "missing-archive" | "broken-link" | "external-review-pending";
  severity: "notice" | "warning";
  message: string;
}

export interface EvidenceHealthResult {
  review: { days: number; dueDays: number; state: "current" | "review-soon" | "overdue" };
  diversity: { publishers: number; sourceTypes: number; independenceGroups: number; counts: Record<string, number> };
  sourceFreshness: { current: number; aging: number; stale: number; unknown: number };
  claims: { critical: number; lowConfidenceCritical: number };
  links: { checked: number; healthy: number; transient: number; broken: number; unchecked: number };
  archives: { covered: number; total: number };
  externalReview: { status: "pending" | "reviewed"; reviewers: string[] };
  warnings: EvidenceWarning[];
}
```

- [ ] **Step 4: Implement rules**

Use review cadences:

```ts
const REVIEW_DUE_DAYS = { current: 90, slow: 365, historical: 730 } as const;
const SOURCE_AGE_DAYS = { current: { aging: 365, stale: 730 }, slow: { aging: 1095, stale: 1825 } } as const;
```

For `historical`, classify dated sources as current unless the link audit is broken; their publication age is not a freshness defect. Unknown publication dates remain `unknown`. Group diversity uses `independenceGroup ?? publisher`. Add warnings for overdue review, low-confidence critical claims, fewer than two independence groups, missing source dates on current claims, no archive coverage, broken links and beta review status.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run tests/evidence/health.test.ts`

Expected: all current, slow, historical and diversity fixtures pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evidence/health.ts src/lib/evidence/types.ts tests/evidence/health.test.ts
git commit -m "feat: calculate explainable evidence health signals"
```

### Task 3: Produce reusable link-audit data

**Files:**
- Modify: `scripts/check-external-links.mjs`
- Create: `public/data/link-health.json`
- Modify: `.gitignore`
- Test: `tests/evidence/link-health.test.ts`

- [ ] **Step 1: Define the stored shape**

```ts
interface LinkHealthRecord {
  url: string;
  checkedAt: string;
  state: "healthy" | "transient" | "broken";
  status: number | null;
}
```

Write a test that loads the generated fixture and rejects records containing response bodies, cookies, authorization headers or query strings known to contain tokens.

- [ ] **Step 2: Modify the link checker**

After each bounded HEAD/GET check, write:

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO timestamp",
  "records": [
    { "url": "https://example.org/source", "checkedAt": "ISO timestamp", "state": "healthy", "status": 200 }
  ]
}
```

Classification:

- `healthy`: 200–399;
- `transient`: 408, 425, 429 or 500–599;
- `broken`: 400–499 except the transient list;
- network timeout: `transient` with `status: null`.

Write atomically to `public/data/link-health.json` and keep records sorted by URL.

- [ ] **Step 3: Run the bounded audit**

Run: `npm run audit:links`

Expected: command completes without exposing response content and writes valid sorted JSON.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run tests/evidence/link-health.test.ts
git add scripts/check-external-links.mjs public/data/link-health.json tests/evidence/link-health.test.ts
git commit -m "feat: publish bounded source link health"
```

### Task 4: Replace the article `/100` score

**Files:**
- Modify: `src/components/EvidenceHealth.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/lib/content.ts`
- Modify: `src/styles/global.css`
- Test: `scripts/audit-build.mjs`

- [ ] **Step 1: Add a regression assertion**

Add a build assertion that article HTML does not contain:

```text
A high score means
```

and does contain:

```text
Signals, not a trust score
```

- [ ] **Step 2: Confirm the current build fails**

Run: `npm run build && npm run audit:build`

Expected: FAIL because current article output still contains score language.

- [ ] **Step 3: Remove the synthetic score**

Change `getSourceDiversity` in `src/lib/content.ts` to return only:

```ts
return { counts, publishers, types, independenceGroups };
```

Update `ArticleLayout.astro` to pass the complete validated metadata required by `calculateEvidenceHealth`, not an `as any` object.

Render in `EvidenceHealth.astro`:

- last editorial check and cadence;
- publisher, source-type and independence-group counts;
- current/aging/stale/unknown source counts;
- critical claim and low-confidence count;
- link and archive coverage;
- external-review status;
- warning list.

The heading note must read: “Signals, not a trust score. These checks reveal maintenance needs; they do not prove that a conclusion is correct.”

- [ ] **Step 4: Add progressive disclosure**

Keep review state, source mix and external-review status visible. Put link detail, archive coverage and warning explanations in a native `<details>` element. Preserve verdict text outside this component.

- [ ] **Step 5: Run gates**

Run: `npm run test && npm run qa`

Expected: no `/100` evidence score remains; article typecheck no longer uses `as any` for health data.

- [ ] **Step 6: Commit**

```bash
git add src/components/EvidenceHealth.astro src/layouts/ArticleLayout.astro src/lib/content.ts src/styles/global.css scripts/audit-build.mjs
git commit -m "feat: replace trust score with evidence signals"
```

### Task 5: Unify data-status and source-dashboard rules

**Files:**
- Modify: `src/pages/data-status.astro`
- Modify: `src/pages/sources.astro`
- Create: `src/pages/data/evidence-health.json.ts`
- Test: `tests/evidence/health-export.test.ts`

- [ ] **Step 1: Write export consistency test**

Test that each visible article produces one health record with its slug, cadence, review state, warnings and no `score` property.

- [ ] **Step 2: Add the generated endpoint**

Return:

```ts
{
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  articles: myths.map((myth) => ({
    slug: myth.data.slug,
    title: myth.data.title,
    health: calculateEvidenceHealth(myth.data, now, linkHealth),
  })),
}
```

- [ ] **Step 3: Rebuild both dashboards from the calculator**

`data-status.astro` becomes the actionable editorial queue sorted:

1. overdue;
2. review soon;
3. current;
4. title.

`sources.astro` keeps aggregate counts but derives freshness, independence groups, archive coverage, low-confidence critical claims and external-review backlog from the same results. Remove the existing generic 365/730-day rule.

- [ ] **Step 4: Add honest empty/partial states**

If link-health data is absent or older than seven days, show “Link audit unavailable or older than seven days” and mark links `unchecked`; never display them as healthy.

- [ ] **Step 5: Run phase gate**

Run:

```bash
npm test
npm run qa
```

Expected: all tests and build audits pass; no health object exposes a numerical quality score.

- [ ] **Step 6: Commit**

```bash
git add src/pages/data-status.astro src/pages/sources.astro src/pages/data/evidence-health.json.ts tests/evidence/health-export.test.ts
git commit -m "feat: unify public evidence health reporting"
```

## Phase release checks

- [ ] Open one `current`, one `slow` and one `historical` article at mobile and desktop widths.
- [ ] Confirm an old historical source is not labelled stale solely because of publication date.
- [ ] Confirm a beta article says external review is pending.
- [ ] Confirm `/data/evidence-health.json` contains all published slugs and no `score`.
- [ ] Run `npm run qa`, deploy with `npx wrangler deploy`, then verify production content.
