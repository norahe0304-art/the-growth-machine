/**
 * [INPUT]: depends on lib/openai-client's chatComplete/generateImage/isMockMode, on lib/fs-utils's ensureDir, on node:fs
 * [OUTPUT]: exports runProduce(...) -> ProducedAsset, real still-image + copy generation; motion only ever delivers a prompt, never rendered
 * [POS]: station 5 of the nine-station pipeline, the only station that makes a real Images API call — degrades to a placeholder SVG in mock mode
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
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
    system: "You are a copy generator. Output exactly one line of copy per the user's prompt, in English, with no explanation and no surrounding quotes.",
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
  `Shot 1 (establish): stay in the everyday context of ${brief.assetXElement.split(" x ")[0] ?? "the asset"}, no sound cue yet`,
  `Shot 2 (contrast): introduce the new element as a visual break, cut on the [for ChatCut] rhythm`,
  `Shot 3 (land): hook copy locks in, frame holds for 1.5s, end`,
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
