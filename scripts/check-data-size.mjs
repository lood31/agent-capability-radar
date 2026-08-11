import { stat } from "node:fs/promises";

const site = new URL("../public/data/site.json", import.meta.url);
const limit = 600_000;
const { size } = await stat(site);
if (size > limit) {
  throw new Error(`site.json exceeds ${limit} bytes: ${size}`);
}
console.log(`site.json size ${size}/${limit} bytes`);
