# Production deployment checklist

## Before connecting Cloudflare

- [ ] `npm ci` completes from a clean checkout.
- [ ] `npm run qa` passes.
- [ ] `npm run audit:links` is run from a machine with normal internet access.
- [ ] Repository contains no `.dev.vars`, database state, tokens or private correction exports.
- [ ] Final Workers project name and hostname are chosen.

## Cloudflare Workers

- [ ] `npx wrangler login` has been completed on the deployment machine, or `CLOUDFLARE_API_TOKEN` is available.
- [ ] `npm run build` creates `dist`.
- [ ] `wrangler.toml` points assets to `dist`.
- [ ] `PUBLIC_SITE_URL` equals the final public origin.
- [ ] `npx wrangler deploy` completes successfully.
- [ ] Every main route opens, including `/story/`.

## Correction database

- [ ] D1 database `qazaq-lens-feedback` created.
- [ ] `migrations/0001_feedback.sql` applied remotely.
- [ ] Workers binding named exactly `QAZAQ_LENS_DB` added.
- [ ] Site redeployed after adding the binding.
- [ ] Production correction submitted and visible in D1.
- [ ] Test record removed or marked resolved.

## Content and trust

- [ ] Every external source URL opens from the deployed site.
- [ ] Access dates are correct.
- [ ] No article is marked reviewed without a real recorded reviewer.
- [ ] Social previews checked in Telegram, Discord and at least one public social platform.
- [ ] English wording checked by an independent reader.
- [ ] Sensitive claims checked for overgeneralization and source relevance.

## Mobile and accessibility

- [ ] Tested at 360 px, 390 px and 430 px widths.
- [ ] Navigation works by keyboard and touch.
- [ ] Light, dark and system themes checked.
- [ ] Install flow checked on Android Chrome.
- [ ] Add to Home Screen instructions checked on iOS Safari.
- [ ] Offline fallback tested after visiting core pages once.
- [ ] Correction form works with screen zoom and keyboard navigation.

## Search and monitoring

- [ ] Sitemap submitted to Google Search Console.
- [ ] `robots.txt` shows the final sitemap origin.
- [ ] Cloudflare Web Analytics enabled only if desired and disclosed in Privacy.
- [ ] Broken-link and correction-review routine scheduled monthly.
