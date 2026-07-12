/**
 * [INPUT]: 依赖 lib/openai-client 的 chatComplete/generateImage/isMockMode，依赖 lib/fs-utils 的 ensureDir，依赖 node:fs
 * [OUTPUT]: 对外提供 runProduce(...) -> ProducedAsset，真生成 still 图 + copy，motion 只交付 prompt 不真渲染
 * [POS]: 六站流水线第 5 站，是唯一动真格调用 Images API 的站 —— mock 时退化为占位 SVG
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chatComplete, generateImage, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import { ensureDir } from "../lib/fs-utils.js";
import type { Brief, NamedAsset, ProducedAsset } from "../types.js";

function placeholderSVG(assetName: string, prompt: string): string {
  const wrapped = prompt.length > 90 ? prompt.slice(0, 87) + "..." : prompt;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <rect width="1536" height="1024" fill="#fafaf8"/>
  <rect x="1" y="1" width="1534" height="1022" fill="none" stroke="#d8d5cd" stroke-width="2"/>
  <text x="768" y="480" font-family="Georgia, serif" font-size="34" fill="#1a1a1a" text-anchor="middle">${assetName}</text>
  <text x="768" y="540" font-family="Georgia, serif" font-size="18" fill="#6b6b63" text-anchor="middle">${wrapped}</text>
  <text x="768" y="960" font-family="monospace" font-size="14" fill="#a8a59c" text-anchor="middle">MOCK ASSET — no real generation</text>
</svg>`;
}

async function produceCopy(brief: Brief): Promise<string> {
  if (isMockMode()) {
    return `[mock copy] ${brief.assetXElement} — ${brief.insight}`;
  }
  return chatComplete({
    system: "你是文案生成器，严格按用户给出的 prompt 输出一条文案，不加解释，不加引号。",
    user: brief.generationPrompts.copy,
    model: DEFAULT_MODEL,
  });
}

async function produceStillAsset(
  assetsDir: string,
  namedAsset: NamedAsset,
  brief: Brief
): Promise<{ assetPath: string; imageModelUsed: string | null }> {
  await ensureDir(assetsDir);
  if (isMockMode()) {
    const svgPath = path.join(assetsDir, `${namedAsset.name}.svg`);
    await writeFile(svgPath, placeholderSVG(namedAsset.name, brief.generationPrompts.image), "utf-8");
    return { assetPath: svgPath, imageModelUsed: null };
  }
  const { b64, modelUsed } = await generateImage({ prompt: brief.generationPrompts.image });
  const pngPath = path.join(assetsDir, `${namedAsset.name}.png`);
  await writeFile(pngPath, Buffer.from(b64, "base64"));
  return { assetPath: pngPath, imageModelUsed: modelUsed };
}

const MOTION_STORYBOARD_TEMPLATE = (brief: Brief): string[] => [
  `镜头1(建立): 沿用 ${brief.assetXElement.split(" x ")[0] ?? "asset"} 的日常语境，无音效铺垫`,
  `镜头2(反差): 引入新元素制造视觉断点，配合 [for ChatCut] 剪辑节奏加速`,
  `镜头3(落版): 钩子文案定格，画面静止1.5秒，收尾`,
];

export async function runProduce(
  assetsDir: string,
  namedAsset: NamedAsset,
  brief: Brief
): Promise<ProducedAsset> {
  const copy = await produceCopy(brief);

  if (namedAsset.format === "motion") {
    return {
      variantId: namedAsset.variantId,
      format: "motion",
      name: namedAsset.name,
      assetPath: null,
      copy,
      motionScript: MOTION_STORYBOARD_TEMPLATE(brief),
      imageModelUsed: null,
      regeneratedCount: 0,
    };
  }

  const { assetPath, imageModelUsed } = await produceStillAsset(assetsDir, namedAsset, brief);
  return {
    variantId: namedAsset.variantId,
    format: "still",
    name: namedAsset.name,
    assetPath,
    copy,
    motionScript: null,
    imageModelUsed,
    regeneratedCount: 0,
  };
}
