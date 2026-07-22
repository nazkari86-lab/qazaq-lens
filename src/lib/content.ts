import { getCollection, type CollectionEntry } from "astro:content";

export type MythEntry = CollectionEntry<"myths">;

export async function getVisibleMyths() {
  const showDrafts = import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_DRAFTS === "true";
  const myths = await getCollection("myths");
  return myths.filter((entry) => showDrafts || !entry.data.draft);
}

export function estimateReadingMinutes(body: string) {
  const words = body.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

export function getRelatedMyths(current: MythEntry, myths: MythEntry[], limit = 3) {
  const topics = new Set(current.data.topics);
  return myths
    .filter((entry) => entry.id !== current.id)
    .map((entry) => ({
      entry,
      score: entry.data.topics.reduce((total, topic) => total + (topics.has(topic) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || b.entry.data.publishedAt.valueOf() - a.entry.data.publishedAt.valueOf())
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function getSourceDiversity(myth: MythEntry) {
  const counts = myth.data.sources.reduce<Record<string, number>>((all, source) => { all[source.type] = (all[source.type] ?? 0) + 1; return all; }, {});
  const publishers = new Set(myth.data.sources.map((source) => source.publisher)).size;
  const types = Object.keys(counts).length;
  const score = Math.min(100, Math.round((publishers / Math.max(1, myth.data.sources.length) * 55) + (types / 5 * 45)));
  return { counts, publishers, types, score };
}

export function getFreshness(myth: MythEntry, now = new Date()) {
  const days = Math.max(0, Math.floor((now.valueOf() - myth.data.lastReviewedAt.valueOf()) / 86400000));
  return { days, state: days <= 180 ? "fresh" : days <= 365 ? "aging" : "stale" } as const;
}
