import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const site = process.env.PUBLIC_SITE_URL ?? "https://qazaq-lens.nazkari86.workers.dev";

export default defineConfig({
  site,
  output: "static",
  compressHTML: true,
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.endsWith("/report-error/") && !page.endsWith("/offline/"),
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
