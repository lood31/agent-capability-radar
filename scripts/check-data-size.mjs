import { readdir, stat } from "node:fs/promises";

const site = new URL("../public/data/site.json", import.meta.url);
const limit = 600_000;
const { size } = await stat(site);
if (size > limit) {
  throw new Error(`site.json exceeds ${limit} bytes: ${size}`);
}
console.log(`site.json size ${size}/${limit} bytes`);

const contentDirectory = new URL("../data/projects/", import.meta.url);
const perProjectLimit = 100_000;
const totalLimit = 10_000_000;
let total = 0;
try {
  for (const name of await readdir(contentDirectory)) {
    if (!name.endsWith(".json")) continue;
    const item = await stat(new URL(name, contentDirectory));
    if (item.size > perProjectLimit) {
      throw new Error(`${name} exceeds ${perProjectLimit} bytes: ${item.size}`);
    }
    total += item.size;
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (total > totalLimit) throw new Error(`project content exceeds ${totalLimit} bytes: ${total}`);
console.log(`project content size ${total}/${totalLimit} bytes`);
