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
