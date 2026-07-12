# The Growth Machine - 六站式增长实验执行器
TypeScript + Node.js 24 + OpenAI SDK

<directory>
bin/ - 命令行入口
scripts/ - 构建与运行脚本
skill/ - Agent 技能定义
src/ - 编排器、类型与阶段实现
test/ - Node 测试套件
waves/ - 每轮实验的计划、简报、资产与结果
</directory>

<config>
package.json - 包元数据、依赖与验证命令
tsconfig.json - TypeScript 编译约束
library.jsonl - 跨波次实验知识库
</config>

架构决策：执行引擎与实验产物分离；`src/` 负责确定性流程，`waves/` 保存可审计的每轮状态。

开发规范：优先短函数和单一数据源；代码结构变化必须同步 L1/L2/L3 文档；JSON 与二进制资产不支持文件头注释，其契约写入所属 L2。

变更日志：2026-07-12 建立 GEB L1 项目地图。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
