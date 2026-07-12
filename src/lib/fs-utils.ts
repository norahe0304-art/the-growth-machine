/**
 * [INPUT]: depends on node:fs/promises, node:path
 * [OUTPUT]: exports waveDir() / ensureDir() / writeJSON() / readJSON() / appendJSONL() / readJSONL() / fileExists()
 * [POS]: the filesystem gateway of lib/; cli.ts and every stages/*.ts file reads and writes waves/ and library.jsonl through this file
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
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

// Rewrites library.jsonl wholesale from a full list of entries: used by the
// measure stage to update a single wave's entry in place (e.g. after a
// measured decide pass changes its winners/sources) without disturbing the
// append-only semantics readJSONL/appendJSONL provide for the normal flow.
export async function writeJSONL<T>(filePath: string, entries: T[]): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const body = entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length > 0 ? "\n" : "");
  await writeFile(filePath, body, "utf-8");
}
