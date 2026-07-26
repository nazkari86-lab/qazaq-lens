import type { EvidenceRegistryRecord } from "./types";

export interface EvidenceCardModel {
  slug: string;
  title: string;
  myth: string;
  verdict: string;
  summary: string;
  articleUrl: string;
  cardUrl: string;
  svgUrl: string;
  lastReviewedLabel: string;
  reviewLabel: string;
  sourceLabel: string;
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character] ?? character));
const verdictLabel = (value: string) => value.replaceAll("-", " ").toUpperCase();
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const wrap = (value: string, limit: number, lines: number) => {
  const words = value.trim().split(/\s+/); const result: string[] = []; let line = "";
  words.forEach((word) => { const candidate = line ? `${line} ${word}` : word; if (candidate.length > limit && line && result.length < lines - 1) { result.push(line); line = word; } else line = candidate; });
  if (line) result.push(line);
  if (result.length > lines) result.splice(lines);
  if (words.join(" ").length > result.join(" ").length) result[result.length - 1] = `${result[result.length - 1].slice(0, Math.max(1, limit - 1))}…`;
  return result;
};

export function buildCardModel(record: EvidenceRegistryRecord): EvidenceCardModel {
  return { slug: record.slug, title: record.title, myth: record.mythStatement, verdict: verdictLabel(record.verdict), summary: record.summary, articleUrl: record.canonicalUrl, cardUrl: `https://qazaqlens.org/cards/${record.slug}/`, svgUrl: `https://qazaqlens.org/cards/${record.slug}.svg`, lastReviewedLabel: `Last reviewed ${dateLabel(record.lastReviewedAt)}`, reviewLabel: record.publicationStatus === "reviewed" ? "Independently reviewed" : "Public beta · independent review pending", sourceLabel: `${record.sourceCount} visible source${record.sourceCount === 1 ? "" : "s"}` };
}

export function buildShortCitation(record: EvidenceRegistryRecord) { return `Qazaq Lens, “${record.title},” ${record.lastReviewedAt}, ${record.canonicalUrl}`; }

export function renderCardSvg(card: EvidenceCardModel) {
  const myth = wrap(card.myth, 50, 2); const summary = wrap(card.summary, 68, 4);
  const text = (lines: string[], x: number, y: number, size: number, fill: string, weight = 400, step = size * 1.22) => lines.map((line, index) => `<text x="${x}" y="${y + index * step}" fill="${fill}" font-family="Georgia, serif" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc"><title id="title">Qazaq Lens evidence card: ${escapeXml(card.title)}</title><desc id="desc">${escapeXml(card.verdict)}. ${escapeXml(card.summary)} ${escapeXml(card.lastReviewedLabel)}.</desc><rect width="1200" height="630" fill="#10262a"/><path d="M0 500C260 400 440 690 700 510S1000 330 1200 440V630H0Z" fill="#173b40"/><rect x="64" y="62" width="1072" height="506" rx="28" fill="#f5f0e6"/><text x="112" y="120" fill="#247d8d" font-family="monospace" font-size="23" font-weight="700" letter-spacing="3">QAZAQ LENS · EVIDENCE CARD</text><rect x="112" y="155" width="${Math.max(160, card.verdict.length * 18 + 42)}" height="42" rx="21" fill="#247d8d"/><text x="133" y="183" fill="#fff" font-family="monospace" font-size="20" font-weight="700" letter-spacing="1">${escapeXml(card.verdict)}</text>${text(myth, 112, 260, 43, "#172526", 700)}${text(summary, 112, 365, 25, "#405457", 400)}<line x1="112" x2="1088" y1="500" y2="500" stroke="#c7bb9a"/><text x="112" y="540" fill="#405457" font-family="monospace" font-size="18">${escapeXml(card.sourceLabel)} · ${escapeXml(card.lastReviewedLabel)}</text><text x="1088" y="540" fill="#405457" text-anchor="end" font-family="monospace" font-size="18">${escapeXml(card.reviewLabel)}</text></svg>`;
}
