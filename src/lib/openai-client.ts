/**
 * [INPUT]: 依赖 openai 官方 SDK，依赖 process.env 的 OPENAI_API_KEY / MODEL / IMAGE_MODEL
 * [OUTPUT]: 对外提供 getClient() / isMockMode() / chatComplete() / generateImage()
 * [POS]: lib/ 的唯一 OpenAI 网关，所有 stages/*.ts 通过此文件访问模型，不直接 import openai
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import OpenAI from "openai";

export const DEFAULT_MODEL = process.env.MODEL || "gpt-5.4";
export const DEFAULT_IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-2";
export const FALLBACK_IMAGE_MODEL = "gpt-image-1";

let client: OpenAI | null = null;
let forcedMock = false;

/**
 * mock 模式的两个触发条件：
 * 1. OPENAI_API_KEY 缺失 → 强制 mock(无论 --mock 是否传入)
 * 2. CLI 显式传入 --mock → 强制 mock
 */
export function setForcedMock(v: boolean): void {
  forcedMock = v;
}

export function isMockMode(): boolean {
  return forcedMock || !process.env.OPENAI_API_KEY;
}

export function getClient(): OpenAI {
  if (isMockMode()) {
    throw new Error("getClient() 在 mock 模式下不应被调用 — 请先检查 isMockMode()");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * 文本生成：包一层 chat.completions，mock 模式下由调用方自行走 mock 分支，
 * 此函数只服务真实路径。
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
 * 图片生成：优先 IMAGE_MODEL，遇 404/未知模型错误自动回退 gpt-image-1 并打日志。
 * 返回 base64 图片数据。
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
    if (!b64) throw new Error("images.generate 未返回 b64_json");
    return { b64, modelUsed: DEFAULT_IMAGE_MODEL };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUnknownModel =
      message.includes("404") ||
      /model/i.test(message) && /(not found|unknown|does not exist|invalid)/i.test(message);
    if (!isUnknownModel) throw err;
    console.warn(
      `[openai-client] IMAGE_MODEL="${DEFAULT_IMAGE_MODEL}" 请求失败(${message})，回退到 "${FALLBACK_IMAGE_MODEL}"`
    );
    const res = await openai.images.generate({
      model: FALLBACK_IMAGE_MODEL,
      prompt: params.prompt,
      size,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("images.generate 回退后仍未返回 b64_json");
    return { b64, modelUsed: FALLBACK_IMAGE_MODEL };
  }
}
