/**
 * [INPUT]: 依赖 node:fs/promises, node:path
 * [OUTPUT]: 对外提供 waveDir() / ensureDir() / writeJSON() / readJSON() / appendJSONL() / readJSONL()
 * [POS]: lib/ 的文件系统网关，cli.ts 与所有 stages/*.ts 通过此文件读写 waves/ 目录与 library.jsonl
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mkdir, writeFile, readFile, appendFile, access } from "node:fs/promises";
import path from "node:path";

export const ROOT = process.cwd();
export const WAVES_DIR = path.join(ROOT, "waves");
export const LIBRARY_PATH = path.join(ROOT, "library.jsonl");

export function waveDirName(waveNumber: number): string {
  return `wave-${String(waveNumber).padStart(2, "0")}`;
}

export function waveDir(waveNumber: number): string {
  return path.join(WAVES_DIR, waveDirName(waveNumber));
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function readJSON<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function appendJSONL(filePath: string, entry: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
}

export async function readJSONL<T>(filePath: string): Promise<T[]> {
  if (!(await fileExists(filePath))) return [];
  const raw = await readFile(filePath, "utf-8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
