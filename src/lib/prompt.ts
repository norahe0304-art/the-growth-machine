/**
 * [INPUT]: depends on node:readline/promises, node:process
 * [OUTPUT]: exports createPrompter() -> { ask(question, fallback?), close() }, a tiny stdin question/answer helper
 * [POS]: lib/ interactive-input utility, used only by the measure command's interactive entry mode (--file bypasses it entirely)
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export interface Prompter {
  ask(question: string, fallback?: string): Promise<string>;
  close(): void;
}

export function createPrompter(): Prompter {
  const rl = createInterface({ input: stdin, output: stdout });
  return {
    async ask(question: string, fallback?: string): Promise<string> {
      const suffix = fallback !== undefined ? ` [${fallback}]` : "";
      const answer = (await rl.question(`${question}${suffix}: `)).trim();
      return answer.length === 0 && fallback !== undefined ? fallback : answer;
    },
    close(): void {
      rl.close();
    },
  };
}
