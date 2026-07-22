import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const sourceType = z.enum([
  "primary",
  "academic",
  "official",
  "journalistic",
  "background",
]);

const sourceSchema = z.object({
  id: z.string().regex(/^S\d+$/, "Source IDs must look like S1, S2, ..."),
  title: z.string().min(3),
  publisher: z.string().min(2),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  accessedAt: z.coerce.date(),
  url: z.url(),
  archivedUrl: z.url().optional(),
  locator: z.string().optional(),
  independenceGroup: z.string().optional(),
  language: z.string().default("English"),
  type: sourceType,
});

const claimSchema = z.object({
  id: z.string().regex(/^C\d+$/, "Claim IDs must look like C1, C2, ..."),
  statement: z.string().min(12),
  kind: z.enum(["fact", "interpretation", "reported-view", "disputed"]),
  significance: z.enum(["critical", "supporting"]),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  sourceIds: z.array(z.string().regex(/^S\d+$/)).min(2),
  note: z.string().optional(),
});

const changelogEntry = z.object({
  date: z.coerce.date(),
  summary: z.string().min(5),
});

const mythSchema = z
  .object({
    title: z.string().min(5),
    mythStatement: z.string().min(5),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    summary: z.string().min(40),
    verdict: z.enum(["false", "misleading", "partly-true", "outdated", "unverified", "disputed"]),
    publicationStatus: z.enum(["beta", "reviewed"]),
    draft: z.boolean().default(false),
    publishedAt: z.coerce.date(),
    lastReviewedAt: z.coerce.date(),
    author: z.string().min(2),
    reviewStatus: z.string().min(10),
    reviewedBy: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    topics: z.array(z.string().min(2)).min(1),
    keyTakeaways: z.array(z.string().min(12)).min(2).max(5),
    ogImage: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    heroImageCredit: z.string().optional(),
    heroImageCreditUrl: z.url().optional(),
    sources: z.array(sourceSchema).min(2),
    claims: z.array(claimSchema).min(1),
    changelog: z.array(changelogEntry).min(1),
  })
  .superRefine((data, ctx) => {
    const sourceIds = data.sources.map((source) => source.id);
    const claimIds = data.claims.map((claim) => claim.id);

    if (new Set(sourceIds).size !== sourceIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Source IDs must be unique within an article.",
      });
    }

    if (new Set(claimIds).size !== claimIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["claims"],
        message: "Claim IDs must be unique within an article.",
      });
    }

    if (data.lastReviewedAt < data.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["lastReviewedAt"],
        message: "Last review date cannot be earlier than publication date.",
      });
    }

    if (data.heroImage && !data.heroImageCredit) {
      ctx.addIssue({ code: "custom", path: ["heroImageCredit"], message: "Every hero image must include visible credit metadata." });
    }
    if (data.heroImage && !data.heroImageCreditUrl) {
      ctx.addIssue({ code: "custom", path: ["heroImageCreditUrl"], message: "Every hero image must include a traceable credit URL." });
    }

    data.claims.forEach((claim, claimIndex) => {
      claim.sourceIds.forEach((sourceId) => {
        if (!sourceIds.includes(sourceId)) {
          ctx.addIssue({
            code: "custom",
            path: ["claims", claimIndex, "sourceIds"],
            message: `Claim ${claim.id} references missing source ${sourceId}.`,
          });
        }
      });

      const independentPublishers = new Set(
        claim.sourceIds
          .map((id) => data.sources.find((source) => source.id === id)?.publisher)
          .filter(Boolean),
      );

      if (independentPublishers.size < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["claims", claimIndex, "sourceIds"],
          message: `Claim ${claim.id} must cite at least two independent publishers.`,
        });
      }
    });

    if (!data.draft && data.publicationStatus === "reviewed" && data.reviewedBy.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewedBy"],
        message: "A reviewed article must name at least one reviewer.",
      });
    }
  });

const myths = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/data/myths",
  }),
  schema: mythSchema,
});

export const collections = { myths };
