import rss from "@astrojs/rss";
import { getVisibleMyths } from "../lib/content";
export async function GET(context: { site?: URL }) {
  const myths = (await getVisibleMyths()).sort((a,b)=>b.data.publishedAt.valueOf()-a.data.publishedAt.valueOf());
  return rss({ title:"Qazaq Lens", description:"Sourced cultural context about Kazakhstan.", site: context.site ?? "https://qazaqlens.org", items: myths.map((entry)=>({ title:entry.data.title, description:entry.data.summary, pubDate:entry.data.publishedAt, link:`/myths/${entry.data.slug}/`, categories:entry.data.topics })) });
}
