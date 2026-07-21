export function GET({ site }: { site?: URL }) {
  const origin = (site ?? new URL("https://qazaq-lens.nazkari86.workers.dev")).origin;
  return new Response(`User-agent: *\nAllow: /\nDisallow: /report-error\nDisallow: /offline\nDisallow: /moderate\nDisallow: /moderate-corrections\n\nSitemap: ${origin}/sitemap-index.xml\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
