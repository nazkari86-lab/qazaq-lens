# Qazaq Lens

Qazaq Lens is a free, mobile-first evidence library that explains recurring misconceptions about Kazakhstan for international readers. It is deliberately narrow: short explainers, visible claim ledgers, direct sources, honest review status and a public correction path.

## Current product

- Nineteen public-beta explainers with claim-by-claim citations
- Pudding-style visual story route at `/story/`
- Searchable evidence library with topic filters
- Public evidence dashboard showing article, claim, source and publisher counts
- “Kazakhstan in 60 seconds” onboarding page
- Reading progress, table of contents, share/copy/print actions and related explainers
- Responsive light/dark interface and accessibility support
- Installable PWA with offline fallback and cached core explainers
- RSS feed, sitemap, dynamic robots.txt, canonical URLs, Open Graph cards and Article JSON-LD
- First-party correction form backed by a Cloudflare Worker route + D1
- GitHub Actions CI, content-schema validation, function-SQL audit and built-HTML integrity audit

## Requirements

- Node.js 22.12 or newer
- npm
- Python 3 + Pillow only when regenerating social images

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:4321`.

## Required validation

```bash
npm run qa
```

This performs:

1. Astro and Cloudflare Function type checks
2. Content-ledger validation
3. Correction SQL placeholder/binding and in-memory migration test
4. Static production build
5. Built-HTML, SEO, PWA asset and internal-link audit

External source links are intentionally a separate, network-dependent check:

```bash
npm run audit:links
```

## Deploy to Cloudflare Workers

The project deploys as a static Workers assets site. Deploys are manual:

```bash
npm run qa
npm run build
npx wrangler deploy
```

Set this environment variable:

```text
PUBLIC_SITE_URL=https://qazaq-lens.nazkari86.workers.dev
```

Run `npx wrangler login` once on the deployment machine, or provide `CLOUDFLARE_API_TOKEN` for non-interactive deploys.

## Activate correction storage

```bash
npx wrangler login
npx wrangler d1 create qazaq-lens-feedback
npx wrangler d1 execute qazaq-lens-feedback --remote --file=migrations/0001_feedback.sql
```

Then add a Workers D1 binding:

```text
Binding name: QAZAQ_LENS_DB
Database: qazaq-lens-feedback
```

Redeploy and submit a real test correction. Before D1 is connected, the page still offers a copy-to-clipboard fallback so a report is not lost.

For local Function testing:

```bash
cp wrangler.example.toml wrangler.local.toml
# replace the example database ID, then pass the file explicitly if needed
npm run pages:dev
```

The committed `wrangler.toml` contains only public Worker/assets configuration. Private database IDs, tokens and local overrides must never be committed.

## Editorial workflow

1. Add sources with unique `S` IDs.
2. Break the article into independently checkable claims with unique `C` IDs.
3. Give each substantial claim at least two source IDs from different publishers.
4. Check that the sources are genuinely independent, not merely differently branded copies.
5. Cite each claim next to the article sentence it supports.
6. Keep the article in `beta` until a real external reviewer is recorded.
7. Log material wording or evidence changes in the public changelog.

See `EDITORIAL_GUIDE.md`, `CONTRIBUTING.md` and `/methodology` for the full standard.

## Generate social and app images

```bash
python3 -m pip install Pillow
npm run og
```

## Honest limitations

- Every current explainer is public beta; no independent human review is claimed.
- Publisher diversity is enforced automatically, but genuine evidentiary independence still requires human judgment.
- External source availability can change and must be rechecked periodically.
- The project is not a government, tourism or general news service and does not speak for every Kazakhstani.
