# Contributing to Qazaq Lens

Contributions are welcome when they improve evidence, clarity, accessibility or technical reliability.

## Content corrections

Use the public correction form when the site is deployed. A useful report includes the page URL, exact problem, reasoning, a direct supporting source and proposed wording when possible.

## Code changes

1. Use Node.js 22.12 or newer.
2. Run `npm ci`.
3. Make a focused branch and keep unrelated formatting changes out of the patch.
4. Run `npm run qa` before opening a pull request.
5. For content changes, update the claim ledger, access dates and changelog.

## Review labels

Do not change an article from `beta` to `reviewed` unless a real external reviewer is recorded in frontmatter. AI systems do not count as reviewers.

## Safety and privacy

Never commit API keys, Cloudflare database IDs, private correction reports or reporter contact details. Use `wrangler.example.toml` as the public template.
