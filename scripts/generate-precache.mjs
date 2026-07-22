import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
}))).flat();
const files = await walk(root);
const assets = files.map((file) => `/${relative(root, file).replaceAll("\\", "/")}`).filter((file) => /\.(?:css|js|png|jpe?g|webp|svg|woff2?|webmanifest)$/.test(file));
const swPath = join(root, "sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw.replace(/const BUILD_ASSETS = \[[\s\S]*?\];/, `const BUILD_ASSETS = ${JSON.stringify(assets)};`);
await writeFile(swPath, sw);
console.log(`Generated offline precache manifest: ${assets.length} build assets`);
