/**
 * [INPUT]: 无外部依赖，纯函数
 * [OUTPUT]: 对外提供 hashString() / mulberry32() —— 确定性哈希与可复现的种子随机数生成器
 * [POS]: lib/ 的确定性工具，simulate.ts 用它把资产名转成可复现的噪声曲线
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// FNV-1a 32位哈希，纯函数，同输入同输出，跨平台稳定
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32：给定种子返回 [0,1) 的确定性伪随机数生成器
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
