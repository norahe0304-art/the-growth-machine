# src/lib/
> L2 | 父级: ../../AGENTS.md

成员清单
fs-utils.ts: 文件系统网关，统一 waves/ 与 library.jsonl 的路径、JSON 和 JSONL 读写。
hash.ts: 确定性工具，以 FNV-1a 与 mulberry32 为模拟和测量提供可复现随机序列。
openai-client.ts: OpenAI 唯一网关，封装文本、图片模型和 mock 模式。
prompt.ts: 交互输入工具，仅服务 measure 命令的终端问答。
report.ts: 静态报告渲染器，把 WaveReadout 烘焙为可审计的 report.html。
theater.ts: 完成波次回放渲染器与共享 THEATER_CSS 真相源，输出带时间线的 theater.html。
theater-live.ts: 实时工作台渲染器，以两秒轮询将波次文件映射为终态组件，并保留两个人工审批门。

职责边界：本目录封装跨站基础设施与展示层，不拥有十站业务决策；stages/ 产出事实，report 和 theater 只呈现事实。theater.ts 定义共享视觉系统，theater-live.ts 只补实时发现、等待态和无虚拟时钟交互。

变更日志：2026-07-13 播种 L2 地图；live workbench 与完成波次回放完成视觉同构。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
