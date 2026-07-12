/**
 * [INPUT]: depends on lib/openai-client's chatComplete/isMockMode, on types.ts's Variant/Brief
 * [OUTPUT]: exports runBrief(variant, moment) -> Brief, whose generationPrompts is the first-class deliverable
 * [POS]: station 2 of the ten-station pipeline, compresses insight's variant into a one-page brief that feeds produce directly
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import type { Brief, Variant } from "../types.js";

const BRIEF_SYSTEM_PROMPT = `You are the brief-station engine of The Growth Machine.
Input is a creative variant that already satisfies the "existing asset x one new element" formula; compress it into a one-page executable brief.

generationPrompts is the most important deliverable of this station: it must be a "ready to run as-is" complete prompt, not a summary, not an outline:
- image: a complete Images API generation prompt, including composition/lighting/style/subject detail
- motion: a complete motion script prompt, explicitly tagged "for ChatCut", explaining the shot logic
- copy: a complete copy-generation prompt, specifying tone/length/key points

Output must be strict JSON, in English:
{"audience":"...","insight":"...","assetXelement":"...","successMetric":"...","generationPrompts":{"image":"...","motion":"...","copy":"..."}}
Output nothing outside the JSON.`;

interface RawBrief {
  audience: string;
  insight: string;
  assetXelement: string;
  successMetric: string;
  generationPrompts: { image: string; motion: string; copy: string };
}

function parseJSONResponse(text: string): RawBrief {
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  return JSON.parse(jsonText) as RawBrief;
}

function mockBrief(variant: Variant, moment: string): RawBrief {
  const assetXelement = `${variant.asset} x ${variant.newElement}`;
  return {
    audience: `an audience following "${moment}"`,
    insight: `the audience is so used to seeing "${variant.asset}" that they scroll past it, but "${variant.newElement}" is enough to make them stop for a second look`,
    assetXelement,
    successMetric: variant.angleType === "moment" ? "48-hour share rate" : "7-day retained exposure",
    generationPrompts: {
      image: `Subject is ${variant.asset}, with visual details grafting in ${variant.newElement}. Style: editorial photography, shallow depth of field, centered composition with negative space, natural light, 16:9`,
      motion: `[for ChatCut] three-shot script: shot 1 establishes ${variant.asset} in its everyday context; shot 2 introduces ${variant.newElement} to create contrast; shot 3 lands the hook copy, 6 seconds total`,
      copy: `Write one hook line, 20 words or fewer, built around "${variant.angle}", restrained tone, no exclamation marks`,
    },
  };
}

export async function runBrief(variant: Variant, moment: string): Promise<Brief> {
  const raw = isMockMode()
    ? mockBrief(variant, moment)
    : parseJSONResponse(
        await chatComplete({
          system: BRIEF_SYSTEM_PROMPT,
          user: `moment: "${moment}"\nvariant: ${JSON.stringify(variant)}`,
          model: DEFAULT_MODEL,
        })
      );

  return {
    variantId: variant.id,
    workingTitle: variant.workingTitle,
    audience: raw.audience,
    insight: raw.insight,
    assetXElement: raw.assetXelement,
    formats: ["still", "motion"],
    successMetric: raw.successMetric,
    generationPrompts: raw.generationPrompts,
  };
}
