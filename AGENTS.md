# The Growth Machine - 十站式增长实验执行器
TypeScript + Node.js 24 + OpenAI SDK

<directory>
.claude-plugin/ - 插件分发清单 (plugin.json + marketplace.json, source="./" 指向仓库根)
bin/ - 命令行入口
brand/ - 品牌包真相源 (install.sh 不物理搬迁, 见 README.md 设计决定)
references/ - 渠道赢家参考库真相源 (同上)
scripts/ - 构建与运行脚本
skill/ - Agent 技能定义 (2 子目录: references/ 站内长契约拆出文件, evals/ 结构化评测)
src/ - 编排器、类型与阶段实现
test/ - Node 测试套件
waves/ - 每轮实验的计划、简报、资产与结果
</directory>

<config>
package.json - 包元数据、依赖与验证命令，plugin.json 的 version 从此文件同步
tsconfig.json - TypeScript 编译约束
library.jsonl - 跨波次实验知识库
install.sh - 符号链接安装器，--check 子命令做 node/codex/LIBTV_ACCESS_KEY 预检
</config>

架构决策：执行引擎与实验产物分离；`src/` 负责确定性流程，`waves/` 保存可审计的每轮状态。
`scripts/`、`references/`、`brand/` 留在仓库根为真相源，`install.sh` 只符号链接 `skill/`
本身，不物理搬迁或额外链接三者，详见 README.md「Skill mode」的设计决定段落。

开发规范：优先短函数和单一数据源；代码结构变化必须同步 L1/L2/L3 文档；JSON 与二进制资产不支持文件头注释，其契约写入所属 L2。

变更日志：2026-07-12 建立 GEB L1 项目地图。2026-07-13 skill/ 补 best-practice 层：
description 修至 1024 字符硬上限内、station index、Gotchas、station 8b 瘦身进
skill/references/rollout-video.md、judge 评分锚点、skill/evals/ 结构化评测、
.claude-plugin/ 分发清单、install.sh --check 预检。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
