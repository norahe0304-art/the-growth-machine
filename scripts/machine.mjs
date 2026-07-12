#!/usr/bin/env node
// [INPUT]: depends on the local node_modules/.bin/tsx and scripts/machine-impl.ts
// [OUTPUT]: single entry point — `node scripts/machine.mjs <stage> [sub] < in.json > out.json`
// [POS]: launcher for the skill layer's six scripted stations (naming/plan/simulate/decide/
//   report/learn); mirrors bin/growth-machine's "locate project root, run via local tsx, no
//   global install" pattern, just in Node instead of bash — plain `node` cannot resolve this
//   repo's internal .js-import-pointing-at-.ts-source specifiers, tsx can
// [PROTOCOL]: update this header on change, then check CLAUDE.md
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const tsxBin = path.join(projectRoot, "node_modules", ".bin", "tsx");
const implPath = path.join(__dirname, "machine-impl.ts");

const result = spawnSync(tsxBin, [implPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (result.error) {
  console.error(`[machine.mjs] failed to launch tsx at ${tsxBin}:`, result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
