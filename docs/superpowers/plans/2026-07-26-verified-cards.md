# Verified Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every explainer into a dated, accessible, reusable evidence card with canonical share, SVG, PNG, citation and embed outputs.

**Architecture:** One pure card-model builder derives safe metadata from the evidence registry. HTML, SVG and clipboard outputs consume that model, preventing verdict, date or review-status drift; PNG conversion runs only in the reader’s browser and falls back cleanly to SVG.

**Tech Stack:** Astro static routes, TypeScript, SVG, browser Canvas API, Vitest

---

## File map

- `src/lib/evidence/cards.ts` — card model, citation and safe SVG serialization.
- `src/pages/cards/[slug].astro` — canonical card and embed page.
- `src/pages/cards/[slug].svg.ts` — deterministic downloadable SVG.
- `src/components/EvidenceCard.astro` — article controls and preview.
- `src/components/ShareTools.astro` — canonical share integration.
- `tests/evidence/cards.test.ts` — escaping, labels and output consistency.

### Task 1: Define and test the canonical card model

**Files:**
- Create: `src/lib/evidence/cards.ts`
- Modify: `src/lib/evidence/types.ts`
- Test: `tests/evidence/cards.test.ts`

- [ ] **Step 1: Write failing card-model tests**

```ts
import { describe, expect, it } from "vitest";
import { buildCardModel, buildShortCitation } from "../../src/lib/evidence/cards";

const record = {
  slug: "borat", title: "Borat Is Fiction", mythStatement: "Borat shows the real Kazakhstan",
  summary: "The films are scripted satire, not documentary evidence.", verdict: "misleading" as const,
  publicationStatus: "beta" as const, lastReviewedAt: "2026-07-20",
  canonicalUrl: "https://qazaqlens.org/myths/borat/", topics: ["Media"], aliases: [],
  claims: [{ id: "C1", statement: "The film is fictional.", significance: "critical" as const, confidence: "high" as const }],
  sourceCount: 6,
};

describe("buildCardModel", () => {
  it("does not imply independent review for beta records", () => {
    expect(buildCardModel(record).reviewLabel).toBe("Public beta · independent review pending");
  });
  it("includes date, source count and canonical article URL", () => {
    const card = buildCardModel(record);
    expect(card.lastReviewedLabel).toBe("Sources checked 20 Jul 2026");
    expect(card.sourceLabel).toBe("6 visible sources");
    expect(card.articleUrl).toBe(record.canonicalUrl);
  });
  it("creates a stable citation", () => {
    expect(buildShortCitation(record)).toContain("Qazaq Lens");
    expect(buildShortCitation(record)).toContain("2026-07-20");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/evidence/cards.test.ts`

Expected: FAIL because the cards module is missing.

- [ ] **Step 3: Implement the model**

```ts
import type { EvidenceRegistryRecord } from "./types";

export interface EvidenceCardModel {
  slug: string;
  myth: string;
  verdict: string;
  summary: string;
  articleUrl: string;
  cardUrl: string;
  svgUrl: string;
  lastReviewedLabel: string;
  reviewLabel: string;
  sourceLabel: string;
}

const verdictLabel = (value: string) => value.replace("-", " ").toUpperCase();

export function buildCardModel(record: EvidenceRegistryRecord): EvidenceCardModel {
  const date = new Date(`${record.lastReviewedAt}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return {
    slug: record.slug,
    myth: record.mythStatement,
    verdict: verdictLabel(record.verdict),
    summary: record.summary,
    articleUrl: record.canonicalUrl,
    cardUrl: `https://qazaqlens.org/cards/${record.slug}/`,
    svgUrl: `https://qazaqlens.org/cards/${record.slug}.svg`,
    lastReviewedLabel: `Sources checked ${date}`,
    reviewLabel: record.publicationStatus === "reviewed" ? "Independently reviewed" : "Public beta · independent review pending",
    sourceLabel: `${record.sourceCount} visible source${record.sourceCount === 1 ? "" : "s"}`,
  };
}

export function buildShortCitation(record: EvidenceRegistryRecord) {
  return `Qazaq Lens, “${record.title},” ${record.lastReviewedAt}, ${record.canonicalUrl}`;
}
```

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run tests/evidence/cards.test.ts
git add src/lib/evidence/cards.ts src/lib/evidence/types.ts tests/evidence/cards.test.ts
git commit -m "feat: define canonical evidence card model"
```

### Task 2: Generate safe SVG cards

**Files:**
- Modify: `src/lib/evidence/cards.ts`
- Create: `src/pages/cards/[slug].svg.ts`
- Test: `tests/evidence/card-svg.test.ts`

- [ ] **Step 1: Write escaping and completeness tests**

```ts
import { describe, expect, it } from "vitest";
import { renderCardSvg } from "../../src/lib/evidence/cards";

it("escapes executable markup and includes accessibility metadata", () => {
  const svg = renderCardSvg({
    slug: "x", myth: "<script>alert(1)</script>", verdict: "FALSE", summary: "Safe & sourced",
    articleUrl: "https://qazaqlens.org/myths/x/", cardUrl: "https://qazaqlens.org/cards/x/",
    svgUrl: "https://qazaqlens.org/cards/x.svg", lastReviewedLabel: "Sources checked 20 Jul 2026",
    reviewLabel: "Public beta · independent review pending", sourceLabel: "2 visible sources",
  });
  expect(svg).not.toContain("<script>");
  expect(svg).toContain("&lt;script&gt;");
  expect(svg).toContain("<title>");
  expect(svg).toContain("<desc>");
  expect(svg).toContain("qazaqlens.org");
});
```

- [ ] **Step 2: Implement deterministic SVG rendering**

Add `escapeXml` covering `& < > " '`, and `wrapText(value, maxCharacters, maxLines)` that returns bounded lines and uses an ellipsis on truncation. Render a 1200×630 SVG using only system fonts, text, rectangles and paths; do not embed remote images or scripts.

The SVG must contain:

- Qazaq Lens wordmark;
- myth label;
- verdict text independent of color;
- bounded summary;
- source count;
- review status;
- review date;
- `qazaqlens.org/myths/<slug>`;
- `<title>` and `<desc>`.

- [ ] **Step 3: Add the static SVG route**

Use `getStaticPaths()` from `getEvidenceRegistry()` and return:

```ts
return new Response(renderCardSvg(buildCardModel(record)), {
  headers: {
    "content-type": "image/svg+xml; charset=utf-8",
    "content-disposition": `inline; filename="qazaq-lens-${record.slug}.svg"`,
    "cache-control": "public, max-age=3600",
  },
});
```

- [ ] **Step 4: Verify all routes**

Run: `npm test && npm run build`

Expected: one SVG exists per published explainer and no SVG contains `<script` or `foreignObject`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evidence/cards.ts src/pages/cards tests/evidence/card-svg.test.ts
git commit -m "feat: generate accessible evidence card SVGs"
```

### Task 3: Add canonical share and embed pages

**Files:**
- Create: `src/pages/cards/[slug].astro`
- Modify: `src/styles/global.css`
- Modify: `public/_headers`
- Test: `scripts/audit-build.mjs`

- [ ] **Step 1: Add build requirements**

Assert that every registry slug has:

- `cards/<slug>/index.html`;
- `cards/<slug>.svg`;
- canonical article URL;
- review-date label;
- source-count label.

- [ ] **Step 2: Build the page**

The page uses `getStaticPaths`, `buildCardModel` and `BaseLayout`. It renders a semantic `<article>` and a compact embed mode when `?embed=1` is present client-side. Controls:

- “Read full evidence”;
- “Download SVG”;
- “Copy citation”;
- “Copy embed code”.

Embed code:

```html
<iframe
  src="https://qazaqlens.org/cards/SLUG/?embed=1"
  title="Qazaq Lens evidence card: MYTH"
  loading="lazy"
  width="640"
  height="420"
  sandbox="allow-popups allow-popups-to-escape-sandbox"
></iframe>
```

Generate this string from the safe card model and copy it with the Clipboard API. Do not insert arbitrary query parameters or user text.

- [ ] **Step 3: Add restrictive framing policy**

Because global `X-Frame-Options: DENY` blocks embeds, update Worker/header handling so only `/cards/*` may be framed. For card paths set:

```text
Content-Security-Policy: frame-ancestors https:; default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'
```

All other pages retain `frame-ancestors 'none'` and `X-Frame-Options: DENY`. Add a Worker response-header test proving the exception is path-scoped.

- [ ] **Step 4: Run build and security checks**

Run: `npm run qa`

Expected: all card routes build; non-card pages remain non-frameable.

- [ ] **Step 5: Commit**

```bash
git add src/pages/cards src/styles/global.css public/_headers worker tests scripts/audit-build.mjs
git commit -m "feat: add canonical evidence card embeds"
```

### Task 4: Upgrade article card controls and PNG fallback

**Files:**
- Modify: `src/components/EvidenceCard.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/styles/global.css`
- Test: `tests/evidence/card-client.test.ts`

- [ ] **Step 1: Extract browser conversion**

Create an exported `svgToPng(svgUrl: string, filename: string)` in `src/lib/evidence/card-client.ts` that:

1. fetches same-origin SVG;
2. creates an object URL;
3. draws it to a 1200×630 canvas;
4. calls `canvas.toBlob("image/png")`;
5. downloads the blob;
6. always revokes object URLs;
7. throws a readable error if Canvas, fetch, image decode or blob conversion fails.

- [ ] **Step 2: Test cleanup and failure**

Mock `URL.createObjectURL`, `URL.revokeObjectURL`, `Image` and canvas. Assert object URLs are revoked on success and error, and the error does not remove the SVG download link.

- [ ] **Step 3: Render the actual preview**

Replace the current text-only button with:

- `<img src={model.svgUrl} alt="">` inside a figure whose caption describes the card;
- Share card;
- Download SVG;
- Download PNG;
- Copy citation;
- Copy embed.

Pass a complete `EvidenceCardModel` from `ArticleLayout.astro`; do not rebuild labels in the component.

- [ ] **Step 4: Add graceful PNG fallback**

If PNG conversion fails, announce: “PNG conversion is unavailable in this browser. Download the SVG instead.” Keep the SVG link focused and available.

- [ ] **Step 5: Verify reduced motion, mobile and print**

At 360px width, controls wrap without horizontal overflow and the preview preserves 1200:630 aspect ratio. In print, hide buttons but keep card date and article URL.

- [ ] **Step 6: Run phase gate and commit**

```bash
npm test
npm run qa
git add src/components/EvidenceCard.astro src/layouts/ArticleLayout.astro src/lib/evidence/card-client.ts src/styles/global.css tests/evidence/card-client.test.ts
git commit -m "feat: add card downloads citations and embeds"
```

## Phase release checks

- [ ] Download SVG and PNG for one false, one outdated and one disputed article.
- [ ] Confirm beta cards say independent review is pending.
- [ ] Paste embed code into a blank local HTML page and confirm the card loads while other site pages remain blocked from framing.
- [ ] Run an accessibility check for keyboard order, status announcements and SVG title/description.
- [ ] Run `npm run qa`, deploy, and verify one production card URL and SVG response headers.

