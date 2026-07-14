# skill/
> L2 | 父级: ../AGENTS.md

成员清单
SKILL.md: Claude Code 技能主文件，agent 自身充当 insight/brief/judge 模型，十站契约 + station index + Gotchas + station 1 前打开 live workbench 的操作承诺。
CODEX.md: 同一十站契约的 Codex CLI 孪生文件，每个 LLM 站改为独立 `codex exec` 调用，并镜像 station 1 前打开 live workbench 的操作承诺。
references/operator-funnel.md: 三卡漏斗完整操作契约，定义 sparks、treatments、双票决策与 theater 三种时态，供 SKILL.md 与 CODEX.md 共用。
references/rollout-video.md: station 8b「produce the channel cut」的完整步骤（image 渠道的 codex exec 生成 + video 渠道的 libtv-skill 上传/建会话/轮询/下载 + ffmpeg 装配），SKILL.md 与 CODEX.md 共用同一份，各自只留 deliverable 合同 + 一行链接。
evals/evals.json: 3 个 wave 场景（moment/evergreen/ugc-loop 各一），每个场景的 expected_behavior 对照 `src/types.ts` 的真实 shape 校验管线产出结构，不判创意质量。
evals/trigger-queries.json: 10 条应触发 + 10 条不应触发的说法，用于校验 SKILL.md frontmatter description 的触发精度。

职责边界：本目录不含运行时逻辑，只含 agent 读取的指令文本与结构化评测数据；`scripts/machine.mjs` 才是确定性站点的真实实现，本目录内容不得重复实现其逻辑，只能调用或引用。

变更日志：2026-07-13 补 best-practice 层，新增 references/ 与 evals/ 两个子目录；同步 live workbench 必须在 station 1 前打开的双文件契约。
变更日志：2026-07-14 新增三卡漏斗操作契约，并同步两份主契约的 operator gate 与 Gotchas。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
