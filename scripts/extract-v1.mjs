import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
const html = readFileSync("legacy/mido-watch-v1.html", "utf8");
const source = html.match(/const seed=(\[[\s\S]*?\n\]);/);
if (!source) throw new Error("V1 seed array not found");
// Only the checked-in, preserved V1 source is evaluated. Never evaluate imports.
const titles = vm.runInNewContext(`(${source[1]})`, {}, { timeout: 1000 });
writeFileSync(
  "src/lib/v1-seed.json",
  JSON.stringify({ version: 1, titles }, null, 2) + "\n",
);
console.log(`Extracted ${titles.length} original entries`);
