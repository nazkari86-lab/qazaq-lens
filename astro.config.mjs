import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const site = process.env.PUBLIC_SITE_URL ?? "https://qazaqlens.org";
const excludedSitemapRoutes = [
  "/404/",
  "/offline/",
  "/report-error/",
  "/moderate/",
  "/moderate-claims/",
  "/moderate-corrections/",
  "/ru/404/",
];

export default defineConfig({
  site,
  output: "static",
  compressHTML: true,
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !excludedSitemapRoutes.some((route) => page.endsWith(route)),
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark-dimmed" },
      wrap: true,
    },
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
});
