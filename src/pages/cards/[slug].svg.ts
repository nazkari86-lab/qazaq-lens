import { getEvidenceRegistry } from "../../lib/evidence/registry";
import { buildCardModel, renderCardSvg } from "../../lib/evidence/cards";

export async function getStaticPaths() {
  return (await getEvidenceRegistry()).map((record) => ({ params: { slug: record.slug }, props: { record } }));
}

export async function GET({ props }: { props: { record: Awaited<ReturnType<typeof getEvidenceRegistry>>[number] } }) {
  const card = buildCardModel(props.record);
  return new Response(renderCardSvg(card), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "content-disposition": `inline; filename="qazaq-lens-${card.slug}.svg"` } });
}
