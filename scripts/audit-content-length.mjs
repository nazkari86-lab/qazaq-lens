import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.join(process.cwd(), "src", "data", "myths");
const rules = {
  baikonur: [450, 700, 6, 3, 3, ["lease", "Kazakhstan", "Russia"]], borat: [550, 850, 8, 6, 8, ["film", "stereotype", "Kazakhstan"]],
  "capital-astana": [450, 700, 5, 4, 4, ["Astana", "capital", "Almaty"]], "economy-oil": [700, 1000, 8, 7, 8, ["oil", "uranium", "diversification"]],
  "ethnic-diversity": [700, 1000, 9, 5, 7, ["ethnic", "language", "deport"]], "kazakh-and-russian": [700, 1000, 7, 3, 6, ["Turkic", "Indo-European", "language"]],
  "nuclear-weapons": [900, 1200, 7, 4, 7, ["nuclear", "Semipalatinsk", "non-proliferation"]], "only-steppe": [500, 750, 7, 3, 4, ["steppe", "mountains", "urban"]],
  "part-of-russia": [700, 950, 8, 3, 4, ["independence", "sovereign", "Russia"]], "silk-roads": [500, 750, 7, 3, 4, ["UNESCO", "Otrar", "network"]], yurts: [450, 700, 6, 3, 4, ["yurt", "heritage", "housing"]],
  "giant-door": [500, 800, 6, 3, 3, ["viral", "archaeological", "Kazakhstan"]], "horse-meat-kumys": [550, 850, 6, 3, 3, ["horse", "kumys", "heritage"]], "kazakhstan-memes": [550, 850, 6, 3, 3, ["memes", "TikTok", "folklore"]],
};
const words = (text) => (text.match(/\b[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*\b/gu) ?? []).length;
const body = (raw) => raw.split(/^---\s*$/m).slice(-1)[0].replace(/<[^>]*>/g, " ").replace(/\[[^\]]*\]\([^)]*\)/g, " ").replace(/[#*_`>|]/g, " ");
const failures = [];
for (const file of (await fs.readdir(root)).filter((name) => name.endsWith(".mdx")).sort()) {
  const slug = file.replace(/\.mdx$/, ""); const rule = rules[slug];
  if (!rule) { failures.push(`${slug}: missing rule`); continue; }
  const raw = await fs.readFile(path.join(root, file), "utf8"); const sourceBody = raw.split(/^---\s*$/m).slice(-1)[0]; const text = body(raw); const [min, max, minHeadings, minClaims, minSources, terms] = rule;
  const count = words(text); const headings = (sourceBody.match(/^##\s/gm) ?? []).length; const claims = (raw.match(/id:\s*"C\d+"/g) ?? []).length; const sources = (raw.match(/id:\s*"S\d+"/g) ?? []).length;
  const missing = terms.filter((term) => !text.toLowerCase().includes(term.toLowerCase()));
  if (count < min || count > max) failures.push(`${slug}: ${count} words, expected ${min}-${max}`);
  if (headings < minHeadings) failures.push(`${slug}: ${headings} headings, expected at least ${minHeadings}`);
  if (claims < minClaims) failures.push(`${slug}: ${claims} claims, expected at least ${minClaims}`);
  if (sources < minSources) failures.push(`${slug}: ${sources} sources, expected at least ${minSources}`);
  if (missing.length) failures.push(`${slug}: missing terms ${missing.join(", ")}`);
  console.log(`${slug}: ${count} words | ${headings} headings | ${claims} claims | ${sources} sources`);
}
if (failures.length) { console.error("\nContent audit failed:"); failures.forEach((item) => console.error(`- ${item}`)); process.exit(1); }
console.log("Content length and topic audit passed.");
