# Security policy

## Supported version

The current `main` branch is supported during the prototype phase.

## Reporting a vulnerability

Do not submit security vulnerabilities through the public content-correction database. Contact the repository owner privately and include reproduction steps, affected route, expected impact and a minimal proof of concept. Do not include real user data.

## Security design

- Static Astro output for public content.
- Cloudflare Pages Functions restricted to `/api/*`.
- Same-origin, content-type, size, honeypot and timing checks on correction submissions.
- No user accounts, advertising scripts or public database reads.
- Security headers in `public/_headers`.
- CI runs type checks, function-SQL validation, production build and built-HTML audit.
