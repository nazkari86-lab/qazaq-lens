import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const errors = [];
const warnings = [];

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
};

const exists = async (file) => {
  try { await fs.access(file); return true; } catch { return false; }
};

const routeToFile = (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/\/{2,}/g, '/');
  if (clean === '/') return path.join(dist, 'index.html');
  const direct = path.join(dist, clean.replace(/^\//, ''));
  if (path.extname(clean)) return direct;
  return path.join(direct, 'index.html');
};

if (!await exists(dist)) {
  console.error('dist/ does not exist. Run npm run build first.');
  process.exit(1);
}

const allFiles = await walk(dist);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
const requiredFiles = [
  'manifest.webmanifest', 'sw.js', 'robots.txt', 'sitemap-index.xml', 'rss.xml',
  'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', '_headers', '_routes.json',
];
for (const relative of requiredFiles) {
  if (!await exists(path.join(dist, relative))) errors.push(`Missing required build file: ${relative}`);
}

const placeholderPatterns = [
  /REPLACE_ME/i,
  /TODO(?:\b|:)/i,
  /example\.com/i,
  /YOUR_[A-Z_]+/,
];

for (const file of htmlFiles) {
  const relative = path.relative(dist, file);
  const html = await fs.readFile(file, 'utf8');

  if (!/<html\s[^>]*lang=["'][^"']+["']/i.test(html)) errors.push(`${relative}: missing html lang`);
  if (!/<title>[^<]{3,}<\/title>/i.test(html)) errors.push(`${relative}: missing or empty title`);
  if (!/<meta\s+name=["']description["'][^>]+content=["'][^"']{20,}["']/i.test(html) && !/<meta\s+content=["'][^"']{20,}["'][^>]+name=["']description["']/i.test(html)) errors.push(`${relative}: missing useful meta description`);
  if (!/<link\s+rel=["']canonical["'][^>]+href=["']https?:\/\//i.test(html) && !/<link\s+href=["']https?:\/\/[^"']+["'][^>]+rel=["']canonical["']/i.test(html)) errors.push(`${relative}: missing absolute canonical URL`);

  const h1Count = (html.match(/<h1(?:\s|>)/gi) ?? []).length;
  if (h1Count !== 1) errors.push(`${relative}: expected exactly one h1, found ${h1Count}`);

  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) errors.push(`${relative}: duplicate IDs: ${duplicateIds.join(', ')}`);

  for (const pattern of placeholderPatterns) {
    if (pattern.test(html)) errors.push(`${relative}: contains placeholder matching ${pattern}`);
  }

  const canonical = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1];
  if (canonical && relative !== '404.html') {
    try {
      const canonicalUrl = new URL(canonical);
      const expectedPath = relative === 'index.html' ? '/' : `/${relative.replace(/index\.html$/, '')}`;
      if (canonicalUrl.pathname !== expectedPath) warnings.push(`${relative}: canonical path ${canonicalUrl.pathname} differs from ${expectedPath}`);
    } catch { errors.push(`${relative}: invalid canonical URL`); }
  }

  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    let url;
    try { url = new URL(href, `https://qazaq-lens.local/${relative.replace(/index\.html$/, '')}`); }
    catch { errors.push(`${relative}: invalid href ${href}`); continue; }
    if (url.origin !== 'https://qazaq-lens.local') continue;
    const target = routeToFile(url.pathname);
    if (!await exists(target)) errors.push(`${relative}: broken internal link ${href} → ${path.relative(dist, target)}`);
  }

  for (const match of html.matchAll(/<(?:img|source)\s+[^>]*(?:src|srcset)=["']([^"']+)["']/gi)) {
    const raw = match[1].split(',')[0].trim().split(/\s+/)[0];
    if (!raw || raw.startsWith('data:') || /^https?:\/\//i.test(raw)) continue;
    let url;
    try { url = new URL(raw, `https://qazaq-lens.local/${relative.replace(/index\.html$/, '')}`); }
    catch { continue; }
    const target = path.join(dist, decodeURIComponent(url.pathname).replace(/^\//, ''));
    if (!await exists(target)) errors.push(`${relative}: missing image/resource ${raw}`);
  }

  if (relative.startsWith(`myths${path.sep}`) && relative !== path.join('myths', 'index.html')) {
    for (const marker of ['Claim ledger', 'Sources', 'Last source review']) {
      if (!html.includes(marker)) errors.push(`${relative}: article missing “${marker}”`);
    }
    if (!html.includes('application/ld+json')) errors.push(`${relative}: article missing JSON-LD`);
  }
}

const manifestPath = path.join(dist, 'manifest.webmanifest');
if (await exists(manifestPath)) {
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (!manifest.name || !manifest.short_name || !manifest.start_url || !manifest.display) errors.push('manifest.webmanifest: missing core install fields');
    if (!Array.isArray(manifest.icons) || !manifest.icons.some((icon) => icon.sizes === '192x192') || !manifest.icons.some((icon) => icon.sizes === '512x512')) errors.push('manifest.webmanifest: requires 192x192 and 512x512 icons');
  } catch (error) { errors.push(`manifest.webmanifest: invalid JSON (${error instanceof Error ? error.message : String(error)})`); }
}

console.log(`Audited ${htmlFiles.length} HTML files and ${allFiles.length} total build files.`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  console.error(`Build audit failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Build audit passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`);
