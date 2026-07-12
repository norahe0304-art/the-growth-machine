/**
 * [INPUT]: depends on the official openai SDK, on process.env's OPENAI_API_KEY / MODEL / IMAGE_MODEL
 * [OUTPUT]: exports getClient() / isMockMode() / chatComplete() / generateImage()
 * [POS]: the sole OpenAI gateway in lib/; every stages/*.ts file reaches the model through this file, never imports openai directly
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import OpenAI from "openai";

export const DEFAULT_MODEL = process.env.MODEL || "gpt-5.4";
export const DEFAULT_IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-2";
export const FALLBACK_IMAGE_MODEL = "gpt-image-1";

let client: OpenAI | null = null;
let forcedMock = false;

/**
 * Two triggers put the machine into mock mode:
 * 1. OPENAI_API_KEY is missing -> forced mock (regardless of --mock)
 * 2. the CLI passes --mock explicitly -> forced mock
 */
export function setForcedMock(v: boolean): void {
  forcedMock = v;
}

export function isMockMode(): boolean {
  return forcedMock || !process.env.OPENAI_API_KEY;
}

export function getClient(): OpenAI {
  if (isMockMode()) {
    throw new Error("getClient() must not be called in mock mode: check isMockMode() first");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Text generation: a thin wrapper over chat.completions. In mock mode the
 * caller takes its own mock branch; this function only serves the real path.
 */
export async function chatComplete(params: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const openai = getClient();
  const model = params.model ?? DEFAULT_MODEL;
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

/**
 * Image generation: tries IMAGE_MODEL first, falls back to gpt-image-1 on a
 * 404/unknown-model error and logs the fallback. Returns base64 image data.
 */
export async function generateImage(params: {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
}): Promise<{ b64: string; modelUsed: string }> {
  const openai = getClient();
  const size = params.size ?? "1536x1024";
  try {
    const res = await openai.images.generate({
      model: DEFAULT_IMAGE_MODEL,
      prompt: params.prompt,
      size,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("images.generate did not return b64_json");
    return { b64, modelUsed: DEFAULT_IMAGE_MODEL };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUnknownModel =
      message.includes("404") ||
      (/model/i.test(message) && /(not found|unknown|does not exist|invalid)/i.test(message));
    if (!isUnknownModel) throw err;
    console.warn(
      `[openai-client] IMAGE_MODEL="${DEFAULT_IMAGE_MODEL}" request failed (${message}), falling back to "${FALLBACK_IMAGE_MODEL}"`
    );
    const res = await openai.images.generate({
      model: FALLBACK_IMAGE_MODEL,
      prompt: params.prompt,
      size,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("images.generate still returned no b64_json after fallback");
    return { b64, modelUsed: FALLBACK_IMAGE_MODEL };
  }
}
