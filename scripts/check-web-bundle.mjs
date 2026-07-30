import { gzipSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("apps/game-web/dist");
const assets = path.join(dist, "assets");
const files = await readdir(assets);
const javascript = [];

for (const file of files.filter(name => name.endsWith(".js"))) {
  const absolute = path.join(assets, file);
  const raw = await readFile(absolute);
  javascript.push({
    file,
    bytes: (await stat(absolute)).size,
    gzipBytes: gzipSync(raw).byteLength,
  });
}

javascript.sort((left, right) => right.gzipBytes - left.gzipBytes);
const totalGzipBytes = javascript.reduce((sum, item) => sum + item.gzipBytes, 0);
const largestGzipBytes = javascript[0]?.gzipBytes ?? 0;
const budgets = {
  totalGzipBytes: 1_500_000,
  largestChunkGzipBytes: 900_000,
  minimumChunkCount: 4,
};
const failures = [];
if (totalGzipBytes > budgets.totalGzipBytes) failures.push(`Total gzipped JS ${totalGzipBytes} exceeds ${budgets.totalGzipBytes}`);
if (largestGzipBytes > budgets.largestChunkGzipBytes) failures.push(`Largest gzipped chunk ${largestGzipBytes} exceeds ${budgets.largestChunkGzipBytes}`);
if (javascript.length < budgets.minimumChunkCount) failures.push(`Expected at least ${budgets.minimumChunkCount} JS chunks, found ${javascript.length}. Replay, editor, and Phaser should remain lazy-loaded.`);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  budgets,
  totals: {
    javascriptChunks: javascript.length,
    totalGzipBytes,
    largestGzipBytes,
  },
  javascript,
  failures,
};
await writeFile(path.join(dist, "bundle-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
