import { getEvidenceRegistry } from "../../lib/evidence/registry";

export async function GET() {
  const records = await getEvidenceRegistry();
  return new Response(
    JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        records,
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
