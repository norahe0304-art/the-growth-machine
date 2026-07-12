/**
 * [INPUT]: 依赖 node:util 的 parseArgs(原生, 无第三方 CLI 框架)，依赖 orchestrator.ts 的 runWave，依赖 stages/learn.ts 的 getLastRunState，依赖 lib/openai-client 的 setForcedMock/isMockMode
 * [OUTPUT]: 对外提供 CLI 入口 —— `growth-machine run "<moment>" [--waves N] [--mock]` 与 `growth-machine next`
 * [POS]: bin/growth-machine 的直接目标，src/ 的唯一可执行入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { parseArgs } from "node:util";
import { runWave } from "./orchestrator.js";
import { getLastRunState } from "./stages/learn.js";
import { setForcedMock, isMockMode } from "./lib/openai-client.js";

function printUsage(): void {
  console.log(`The Growth Machine

用法:
  growth-machine run "<moment>" [--waves N] [--mock]   跑 N 波(默认 1)
  growth-machine next                                   从 library.jsonl 续跑下一波

环境变量:
  OPENAI_API_KEY   缺失时强制 mock
  MODEL            默认 gpt-5.4
  IMAGE_MODEL      默认 gpt-image-2，404/未知模型时自动回退 gpt-image-1
`);
}

async function runCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      waves: { type: "string", default: "1" },
      mock: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const moment = positionals[0];
  if (!moment) {
    console.error("缺少 moment 参数。用法: growth-machine run \"<moment>\" [--waves N] [--mock]");
    process.exitCode = 1;
    return;
  }

  setForcedMock(Boolean(values.mock));
  const waves = Math.max(1, parseInt(String(values.waves), 10) || 1);

  console.log(`[growth-machine] moment="${moment}" waves=${waves} mock=${isMockMode()}`);

  for (let w = 1; w <= waves; w++) {
    console.log(`\n[growth-machine] --- wave ${w}/${waves} ---`);
    const readout = await runWave(moment, w);
    const scaleCount = readout.decided.filter((d) => d.verdict === "SCALE").length;
    const killCount = readout.decided.filter((d) => d.verdict === "KILL").length;
    const iterateCount = readout.decided.filter((d) => d.verdict === "ITERATE").length;
    console.log(
      `[growth-machine] wave ${w} done: ${readout.variants.length} variants, ${readout.produced.length} assets produced, decide = SCALE:${scaleCount} KILL:${killCount} ITERATE:${iterateCount}`
    );
  }

  console.log(`\n[growth-machine] complete. see waves/wave-NN/report.html`);
}

async function nextCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      mock: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  setForcedMock(Boolean(values.mock));

  const state = await getLastRunState();
  if (!state) {
    console.error("library.jsonl 为空，找不到可续跑的上一波。请先用 `growth-machine run` 起波。");
    process.exitCode = 1;
    return;
  }

  const nextWave = state.lastWave + 1;
  console.log(`[growth-machine] 续跑 moment="${state.moment}" wave=${nextWave} mock=${isMockMode()}`);
  const readout = await runWave(state.moment, nextWave);
  console.log(`[growth-machine] wave ${nextWave} done: ${readout.produced.length} assets produced`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "run") {
    await runCommand(rest);
  } else if (command === "next") {
    await nextCommand(rest);
  } else {
    printUsage();
    process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error("[growth-machine] fatal:", err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
