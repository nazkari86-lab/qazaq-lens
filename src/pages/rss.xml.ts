import rss from "@astrojs/rss";
import { getVisibleMyths } from "../lib/content";

function buildDescription(entry: Awaited<ReturnType<typeof getVisibleMyths>>[number]): string {
  const parts = [entry.data.summary];
  if (entry.data.keyTakeaways?.length) {
    parts.push("\n\nKey takeaways:");
    for (const point of entry.data.keyTakeaways) parts.push(`• ${point}`);
  }
  return parts.join("\n");
}

export async function GET(context: { site?: URL }) {
  const myths = (await getVisibleMyths()).sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
  return rss({
    title: "Qazaq Lens",
    description: "Sourced cultural context about Kazakhstan.",
    site: context.site ?? "https://qazaqlens.org",
    items: myths.map((entry) => ({
      title: entry.data.title,
      description: buildDescription(entry),
      pubDate: entry.data.publishedAt,
      link: `/myths/${entry.data.slug}/`,
      categories: entry.data.topics,
    })),
  });
}
