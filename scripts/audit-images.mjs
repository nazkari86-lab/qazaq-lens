import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.join(process.cwd(), "src", "data", "myths");
const publicRoot = path.join(process.cwd(), "public");
const entries = [];
for (const file of (await fs.readdir(root)).filter((name) => name.endsWith(".mdx")).sort()) {
  const raw = await fs.readFile(path.join(root, file), "utf8");
  const slug = file.replace(/\.mdx$/, "");
  const image = raw.match(/^heroImage:\s*"([^"]+)"/m)?.[1];
  const alt = raw.match(/^heroImageAlt:\s*"([^"]+)"/m)?.[1];
  if (!image) throw new Error(`${slug}: missing heroImage`);
  if (!alt || alt.length < 12) throw new Error(`${slug}: heroImageAlt is missing or too short`);
  if (!image.startsWith("/") || image.includes("..")) throw new Error(`${slug}: invalid local heroImage ${image}`);
  const filePath = path.join(publicRoot, image.slice(1));
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats?.isFile() || stats.size < 1024) throw new Error(`${slug}: missing or empty image ${image}`);
  entries.push({ slug, image });
}
const duplicates = [...new Map(entries.map((entry) => [entry.image, entries.filter((item) => item.image === entry.image).map((item) => item.slug)])).entries()].filter(([, slugs]) => slugs.length > 1);
if (duplicates.length) { for (const [image, slugs] of duplicates) console.error(`Duplicate hero image ${image}: ${slugs.join(", ")}`); process.exit(1); }
console.log(`Image audit passed: ${entries.length} articles, ${new Set(entries.map((entry) => entry.image)).size} unique hero images.`);
