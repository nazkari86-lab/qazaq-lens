import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const mythsDir = path.join(process.cwd(), "src", "data", "myths");
const outPath = path.join(process.cwd(), "public", "data", "claims.json");

function parseYamlField(raw, key) {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = raw.match(re);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

function parseYamlList(raw, key) {
  // inline: topics: ["A", "B"]
  const inline = raw.match(new RegExp(`^${key}:\\s*\\[([^\\]]+)\\]`, "m"));
  if (inline) {
    return inline[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  // block list: \n  - "A"
  const block = raw.match(new RegExp(`^${key}:[\\s\\S]*?(?=^\\w|^---|\\.{3}$)`, "m"));
  if (!block) return [];
  return (block[0].match(/^\s+-\s+"?([^"\n]+)"?/gm) ?? [])
    .map((l) => l.replace(/^\s+-\s+"?/, "").replace(/"?\s*$/, "").trim());
}

function slugToId(slug) {
  return "QL-" + slug.toUpperCase().replace(/-/g, "") + "-001";
}

function countMatches(raw, pattern) {
  return (raw.match(pattern) ?? []).length;
}

function evidenceStrength(sourceCount, claimCount) {
  const total = sourceCount + claimCount;
  if (total >= 10) return "strong";
  if (total >= 6) return "moderate";
  return "limited";
}

const files = (await fs.readdir(mythsDir))
  .filter((f) => f.endsWith(".mdx"))
  .sort();

const claims = [];
for (const file of files) {
  const raw = await fs.readFile(path.join(mythsDir, file), "utf8");
  const frontmatter = raw.split(/^---\s*$/m)[1] ?? "";

  const slug = parseYamlField(frontmatter, "slug") ?? file.replace(/\.mdx$/, "");
  const mythStatement = parseYamlField(frontmatter, "mythStatement") ?? "";
  const verdict = parseYamlField(frontmatter, "verdict") ?? "unverified";
  const summary = parseYamlField(frontmatter, "summary") ?? "";
  const publishedAt = parseYamlField(frontmatter, "publishedAt") ?? "";
  const lastReviewedAt = parseYamlField(frontmatter, "lastReviewedAt") ?? publishedAt;
  const reviewStatus = parseYamlField(frontmatter, "reviewStatus") ?? "editorial_review_only";
  const topics = parseYamlList(frontmatter, "topics");

  const sourceCount = countMatches(frontmatter, /^\s+- id:\s*"S\d+"/gm);
  const claimCount = countMatches(frontmatter, /^\s+- id:\s*"C\d+"/gm);

  claims.push({
    claim_id: slugToId(slug),
    slug,
    claim: mythStatement,
    normalized_claim: mythStatement,
    verdict,
    summary,
    article_url: `https://qazaqlens.org/myths/${slug}/`,
    language: "en",
    topics,
    published_at: publishedAt,
    updated_at: lastReviewedAt,
    review_status: reviewStatus,
    source_count: sourceCount,
    claim_count: claimCount,
    evidence_strength: evidenceStrength(sourceCount, claimCount),
  });
}

const out = {
  schema_version: "1.1",
  generated_at: new Date().toISOString().slice(0, 10),
  license: "CC-BY-4.0",
  publisher: {
    name: "Qazaq Lens",
    url: "https://qazaqlens.org",
    author: "Dulat Nurlanuly",
  },
  total_articles: claims.length,
  claims,
};

await fs.writeFile(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Generated claims.json — ${claims.length} articles`);
