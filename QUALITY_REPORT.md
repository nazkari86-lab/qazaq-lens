# Qazaq Lens — implementation and QA report

Date: 2026-07-20
Version: 1.0.0

## Product improvements

- Expanded the single-page prototype into a 22-route mobile-first product.
- Added nine evidence-led explainers, a searchable library, onboarding, evidence dashboard, accessibility, privacy and offline pages.
- Added a Pudding-style scrollytelling story route that turns the nine claims into a visual pattern.
- Added article reading progress, table of contents, key takeaways, share/copy/print controls, related reading and visible review metadata.
- Added installable PWA behaviour, generated 192/512 icons, offline fallback and cached core content.
- Added RSS, dynamic robots.txt, filtered sitemap, canonical URLs, social previews, Article/Breadcrumb JSON-LD and security headers.

## Editorial integrity

- Every article exposes stable claim and source IDs.
- Content schema blocks duplicate IDs, missing cited sources, fewer than two publishers and reviewed status without a recorded external reviewer.
- Claims distinguish fact, interpretation, reported view and disputed material.
- Confidence labels and last source-review dates remain visible.
- Current explainers are honestly marked public beta because independent human review is pending.

## Correction system

- First-party form with required evidence fields, optional identity/contact fields and clipboard fallback.
- Same-origin, JSON content type, size, honeypot, timing, URL and email validation.
- Cloudflare Worker route with D1 storage and non-public status workflow.
- Local end-to-end test returned HTTP 201 and confirmed the persisted row.
- A real D1 placeholder/binding mismatch in the SQL INSERT was detected during end-to-end testing, fixed, and added to an automated function audit so it cannot silently recur.

## Automated verification

`npm run qa` currently passes:

- Astro check: 0 errors, 0 warnings, 0 hints
- Cloudflare Function TypeScript check: passed
- correction function SQL/migration audit: passed
- static build: passed
- built routes: 22
- built HTML/PWA/internal-link audit: passed

The network-dependent source-link checker is available as `npm run audit:links`. It could not run inside the artifact container because outbound requests were unavailable; URLs were separately researched during content creation and should still be checked again from CI or the owner's machine before promotion.

## External setup still required

1. Deploy manually with `npm run build && npx wrangler deploy` after `wrangler login` or `CLOUDFLARE_API_TOKEN`.
2. Set `PUBLIC_SITE_URL` to the final hostname in any deployment environment that overrides defaults.
3. Create D1, apply the migration and bind it as `QAZAQ_LENS_DB`.
4. Submit one production correction and inspect the stored record.
5. Obtain independent human reviews before changing any article from beta to reviewed.
6. Recheck all external source URLs and social previews after deployment.
