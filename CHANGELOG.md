# Changelog

## Unreleased

- Added two evidence-led explainers: Baikonur and the Silk Roads, with real Wikimedia Commons photography and official/UNESCO sources.
- Expanded the evidence library from five to nine public-beta explainers.
- Added the `/story/` scrollytelling route for the nine-myth visual narrative.
- Switched deployment documentation to the current manual Cloudflare Workers/Wrangler flow.
- Added a Worker entrypoint so manual `wrangler deploy` serves both static assets and `/api/report-error`.
- Cleared current Astro and TypeScript QA hints in the story route and content schema.

## 1.0.0 — 2026-07-20

- Expanded the prototype to five evidence-led explainers.
- Added a mobile-first evidence library with search and topic filters.
- Added public claim/source ledgers, confidence labels and related reading.
- Added evidence dashboard, RSS, structured data, social cards and dynamic robots output.
- Added PWA installation, offline fallback and generated app icons.
- Added first-party correction submission through Cloudflare Functions and D1.
- Added accessibility, privacy, methodology and image-credit pages.
- Added strict content validation, GitHub Actions CI, function SQL audit and built-HTML audit.
- Fixed the D1 correction INSERT placeholder mismatch found during end-to-end testing.
